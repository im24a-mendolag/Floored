'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { crashZoneBand } from '@/lib/survival/survival-perks'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { computeMultiplier, initCrash, startCrashRound } from '@/games/crash/engine'
import type { CrashState } from '@/games/crash/types'

interface CrashResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface CrashGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<CrashResult>
}

interface PendingResult {
  tone: 'win' | 'loss'
  label: string
  outcomeLabel: string
  entry: MatchHistoryEntry
}

function crashPendingResult(
  outcome: 'win' | 'loss',
  betAmount: number,
  payout: number,
  multiplier: number,
): PendingResult {
  const subtitle =
    outcome === 'win'
      ? `${formatChips(betAmount)} · Cashed at ${formatMultiplier(multiplier)}`
      : `${formatChips(betAmount)} · Crashed at ${formatMultiplier(multiplier)}`
  const built = buildPendingResult(
    { outcome, betAmount, payout },
    subtitle,
    { winLabel: 'Total winnings', lossLabel: 'No winnings' },
  )
  return {
    tone: built.tone === 'win' ? 'win' : 'loss',
    label: built.label,
    outcomeLabel: built.outcomeLabel,
    entry: built.entry,
  }
}

// Inline growth formula so CrashCurve has no engine dependency
function mult(ms: number) { return Math.exp(0.23 * ms / 1000) }

function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return `M ${pts[0]![0]} ${pts[0]![1]}`
  let d = `M ${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

function CrashCurve({
  elapsedMs,
  outcome,
}: {
  elapsedMs: number
  outcome: 'win' | 'loss' | null
}) {
  const BOTTOM = 52
  const LEFT   = 8
  const RIGHT  = 152
  const TOP    = 5

  if (elapsedMs <= 50) {
    return (
      <svg viewBox="0 0 160 60" className="w-full h-full" preserveAspectRatio="none">
        <line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} stroke="#27272a" strokeWidth="0.5" />
        <line x1={LEFT} y1={TOP}    x2={LEFT}  y2={BOTTOM} stroke="#27272a" strokeWidth="0.5" />
        <circle cx={LEFT} cy={BOTTOM} r="1.5" fill="#3f3f46" />
      </svg>
    )
  }

  const curMult = mult(elapsedMs)

  const maxTime = Math.max(elapsedMs + 3000, 8000)
  const maxMult = Math.max(curMult * 1.8, 3)

  const toX = (t: number) => LEFT + (t / maxTime) * (RIGHT - LEFT)
  const toY = (m: number) => BOTTOM - ((m - 1) / (maxMult - 1)) * (BOTTOM - TOP)

  const steps = 100
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * elapsedMs
    pts.push([toX(t), toY(mult(t))])
  }

  const last  = pts[pts.length - 1]!
  const lineD = buildSmoothPath(pts)
  const fillD = `${lineD} L ${last[0].toFixed(2)} ${BOTTOM} L ${LEFT} ${BOTTOM} Z`

  // Analytical tangent: avoids jumps when maxTime/maxMult snap to a new step.
  // d(X)/dt and d(Y)/dt derived from the linear mapping + exponential growth.
  const GROWTH = 0.23 / 1000
  const vx  = (RIGHT - LEFT) / maxTime
  const vy  = -(BOTTOM - TOP) / (maxMult - 1) * GROWTH * curMult
  const vlen = Math.sqrt(vx * vx + vy * vy) || 1
  const nx  = vx / vlen
  const ny  = vy / vlen

  // Tiny sleek arrowhead
  const A     = 2.2
  const theta = Math.PI / 7
  const tipX  = last[0]
  const tipY  = last[1]
  const w1x   = tipX - A * (nx * Math.cos(theta)  - ny * Math.sin(theta))
  const w1y   = tipY - A * (nx * Math.sin(theta)  + ny * Math.cos(theta))
  const w2x   = tipX - A * (nx * Math.cos(theta)  + ny * Math.sin(theta))
  const w2y   = tipY - A * (-nx * Math.sin(theta) + ny * Math.cos(theta))

  const color =
    outcome === 'loss' ? '#ef4444' :
    outcome === 'win'  ? '#22c55e' :
    curMult >= 5       ? '#f97316' :
    curMult >= 3       ? '#eab308' :
    curMult >= 2       ? '#4ade80' : '#a1a1aa'

  return (
    <svg viewBox="0 0 160 60" className="w-full h-full" preserveAspectRatio="none">
      <line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} stroke="#27272a" strokeWidth="0.5" />
      <line x1={LEFT} y1={TOP}    x2={LEFT}  y2={BOTTOM} stroke="#27272a" strokeWidth="0.5" />
      <path d={fillD} fill={color} fillOpacity={outcome ? 0.08 : 0.05} />
      <path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`${tipX.toFixed(2)},${tipY.toFixed(2)} ${w1x.toFixed(2)},${w1y.toFixed(2)} ${w2x.toFixed(2)},${w2y.toFixed(2)}`}
        fill={color}
      />
    </svg>
  )
}

export function CrashGame({ mode, bankroll, onBet, onResolve }: CrashGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { crashZone } = useSurvivalPerks('crash')
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound]         = useState<CrashState>(initCrash())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet]     = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx]   = useState(() => pickQuote())

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const canStart     = currentBet >= minBet && currentBet <= bankroll
  const showCrashZone = mode === 'survival' && crashZone && isInProgress
  const crashBand = showCrashZone ? crashZoneBand(round.crashAt) : null

  const handleNewRound = useCallback(() => {
    unlock()
    setRound(initCrash())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
    setElapsedMs(0)
  }, [autoReBet, lastBet, bankroll])

  // Drive the live multiplier on a 50ms tick
  useEffect(() => {
    if (!isInProgress) return

    const startTime = Date.now()
    const crashAt   = round.crashAt
    const betAmount = round.betAmount

    const id = setInterval(() => {
      const elapsed = Date.now() - startTime
      const m       = computeMultiplier(elapsed)
      setElapsedMs(elapsed)

      if (m >= crashAt) {
        clearInterval(id)
        setRound(prev => ({
          ...prev,
          stage: 'settled',
          currentMultiplier: crashAt,
          payoutMultiplier: 0,
          outcome: 'loss',
          message: `Crashed at ${formatMultiplier(crashAt)}`,
        }))
        const resolved = resolveGame(onResolve, {
          outcome: 'loss',
          betAmount,
          payout: 0,
          multiplier: crashAt,
        })
        setPendingResult(
          crashPendingResult('loss', betAmount, resolved.payout, resolved.multiplier ?? crashAt),
        )
      }
    }, 50)

    return () => clearInterval(id)
  }, [isInProgress, round.crashAt, round.betAmount, onResolve])

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart || !lock()) return
    onBet?.(currentBet)
    setQuoteIdx((prev) => pickQuote(prev))
    setLastBet(currentBet)
    setElapsedMs(0)
    setRound(startCrashRound(currentBet))
    setCurrentBet(0)
  }

  function handleCashOut() {
    if (!isInProgress) return
    const m      = computeMultiplier(elapsedMs)
    const payout = Math.round(round.betAmount * m)
    setRound(prev => ({
      ...prev,
      stage: 'settled',
      currentMultiplier: m,
      payoutMultiplier: m,
      outcome: 'win',
      message: `Cashed out at ${formatMultiplier(m)}`,
    }))
    const resolved = resolveGame(onResolve, {
      outcome: 'win',
      betAmount: round.betAmount,
      payout,
      multiplier: m,
    })
    setPendingResult(
      crashPendingResult('win', round.betAmount, resolved.payout, resolved.multiplier ?? m),
    )
  }

  function handleNextCrash() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    handleNewRound()
    survivalAfterNext(mode)
  }

  const displayMult = isInProgress ? computeMultiplier(elapsedMs) : round.currentMultiplier

  const multColor =
    isSettled && round.outcome === 'loss' ? 'text-red-400' :
    isSettled && round.outcome === 'win'  ? 'text-green-400' :
    displayMult >= 5  ? 'text-orange-400' :
    displayMult >= 3  ? 'text-yellow-300' :
    displayMult >= 2  ? 'text-green-400'  : 'text-zinc-200'

  return (
    <div className={GAME_CARD_SHELL}>

      {/* Status bar */}
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Crash</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4"
        entries={matchHistory}
        gameLabel="Crash"
      >
        <GameDockBackButton mode={mode} visible={isBetting} />
        {showCrashZone && crashBand && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Crash zone ~{crashBand.low}×–{crashBand.high}×
          </PerkHint>
        )}
        <GameActiveBetBadge betAmount={round.betAmount} visible={(isInProgress || isSettled) && round.betAmount > 0} />

        <div className="flex w-full max-w-md flex-1 min-h-0 flex-col items-center justify-center gap-2">
          <div className="relative z-10 flex min-h-[7.5rem] flex-col items-center justify-center text-center pointer-events-none select-none">
            {isBetting ? (
              <>
                <p className="text-zinc-700 text-xs uppercase tracking-widest mb-2">Ready</p>
                <p className="text-7xl sm:text-8xl font-black text-zinc-800 tabular-nums">1.00×</p>
                <p className="text-sm mt-2 invisible">{'\u00A0'}</p>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-widest text-zinc-600 mb-2">
                  {isSettled
                    ? round.outcome === 'win'
                      ? 'Cashed Out At'
                      : 'Crashed At'
                    : 'Multiplier'}
                </p>
                <p className={`text-7xl sm:text-8xl font-black tabular-nums transition-colors duration-100 ${multColor}`}>
                  {formatMultiplier(displayMult)}
                </p>
                <p className="text-sm mt-2 invisible">{'\u00A0'}</p>
              </>
            )}
          </div>

          <div className="min-h-10 flex w-full shrink-0 items-center justify-center">
            <p className="max-w-md px-2 text-center text-xs text-zinc-500">
              {isBetting
                ? 'Place chips and start. Cash out before the curve crashes.'
                : isInProgress
                  ? 'Multiplier rises until crash — cash out anytime to lock winnings.'
                  : '\u00A0'}
            </p>
          </div>

          <div className="relative h-28 w-full shrink-0 sm:h-32">
            <div className="absolute inset-0">
              <CrashCurve elapsedMs={elapsedMs} outcome={round.outcome} />
            </div>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || isInProgress}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={isInProgress}
            minBet={minBet}
          />

          <div className="h-10 flex items-center justify-center">
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isInProgress && (
              <p className="text-sm text-zinc-400 tabular-nums">
                Cashout now:{' '}
                <span className="font-semibold text-emerald-400">
                  {formatChips(Math.round(round.betAmount * displayMult))}
                </span>
              </p>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                outcomeLabel={pendingResult.outcomeLabel}
                label={pendingResult.label}
                tone={pendingResult.tone}
              />
            )}
            {isSettled && !pendingResult && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={isSettled ? handleNextCrash : isInProgress ? handleCashOut : handleStart}
              disabled={isBetting && !canStart}
              className={[
                'min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg',
                isInProgress
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900',
              ].join(' ')}
            >
              {isSettled
                ? 'Next →'
                : isInProgress
                  ? `Cash Out · ${formatMultiplier(displayMult)}`
                  : 'Start →'}
            </button>
          </div>

          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
