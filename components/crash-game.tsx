'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { computeMultiplier, initCrash, startCrashRound } from '@/games/crash/engine'
import type { CrashState } from '@/games/crash/types'
import { GAMBLING_QUOTES, pickQuote } from '@/lib/gambling-quotes'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

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
  onResolve: (result: CrashResult) => void
}

interface PendingResult {
  tone: 'win' | 'loss'
  label: string
  entry: MatchHistoryEntry
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

  const handleNewRound = useCallback(() => {
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
        onResolve({ outcome: 'loss', betAmount, payout: 0, multiplier: crashAt })
        setPendingResult({
          tone: 'loss',
          label: `-${formatChips(betAmount)}`,
          entry: {
            id: `${Date.now()}-crash-${Math.random().toString(36).slice(2)}`,
            at: new Date(),
            title: `Crashed ${formatMultiplier(crashAt)} · −${formatChips(betAmount)}`,
            subtitle: `${formatChips(betAmount)} staked`,
            tone: 'loss',
          },
        })
      }
    }, 50)

    return () => clearInterval(id)
  }, [isInProgress, round.crashAt, round.betAmount, onResolve])

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
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
    onResolve({ outcome: 'win', betAmount: round.betAmount, payout, multiplier: m })
    setPendingResult({
      tone: 'win',
      label: `+${formatChips(payout)}`,
      entry: {
        id: `${Date.now()}-crash-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title: `+${formatChips(payout)} @ ${formatMultiplier(m)}`,
        subtitle: `${formatChips(round.betAmount)} bet`,
        tone: 'win',
      },
    })
  }

  function handleNextCrash() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    handleNewRound()
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
        boardClassName="relative flex min-h-0 items-center justify-center"
        entries={matchHistory}
        gameLabel="Crash"
      >
        {/* SVG curve */}
        <div className="absolute inset-0 px-4 py-3">
          <CrashCurve elapsedMs={elapsedMs} outcome={round.outcome} />
        </div>

        {/* Active bet badge — shown in top-left while round is live */}
        {(isInProgress || isSettled) && round.betAmount > 0 && (
          <div className="absolute left-2 top-2 z-20 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(round.betAmount)}</p>
          </div>
        )}

        {/* Multiplier overlay */}
        <div className="relative z-10 text-center pointer-events-none select-none">
          {isBetting ? (
            <>
              <p className="text-zinc-700 text-xs uppercase tracking-widest mb-2">Ready</p>
              <p className="text-7xl sm:text-8xl font-black text-zinc-800 tabular-nums">1.00×</p>
              <p className="text-zinc-700 text-sm mt-2">Place your bet to start</p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest text-zinc-600 mb-2">
                {isSettled
                  ? (round.outcome === 'win' ? 'Cashed Out At' : 'Crashed At')
                  : 'Multiplier'}
              </p>
              <p className={`text-7xl sm:text-8xl font-black tabular-nums transition-colors duration-100 ${multColor}`}>
                {formatMultiplier(displayMult)}
              </p>
              <p className={`text-zinc-500 text-sm mt-2 ${isInProgress ? '' : 'invisible'}`}>
                Potential{' '}
                <span className="text-zinc-300 font-semibold">
                  {formatChips(Math.round(round.betAmount * displayMult))}
                </span>
              </p>
            </>
          )}
        </div>
      </GameFieldWithHistory>

      {/* Control zone */}
      <div className={GAME_CONTROL_DOCK_M}>
        {/* Top: variable content (chips during betting, result after settled) */}
        <div className="flex-1 flex flex-col items-center justify-start pt-3 gap-1 min-h-0">
          {isBetting && (
            <div className="w-full max-w-sm flex flex-col gap-1">
              <div className="flex flex-nowrap justify-center gap-2">
                {CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => addChip(chip.value)}
                    disabled={chip.value > bankroll - currentBet}
                    className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    {chip.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addChip(Math.floor(bankroll / 4))}
                  disabled={currentBet >= bankroll || bankroll <= 0}
                  className="h-12 px-3 rounded-full bg-blue-100 hover:bg-blue-50 border-2 border-blue-200 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ¼
                </button>
                <button
                  type="button"
                  onClick={() => addChip(Math.floor(bankroll / 2))}
                  disabled={currentBet >= bankroll || bankroll <= 0}
                  className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ½
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentBet(bankroll)}
                  disabled={currentBet >= bankroll || bankroll <= 0}
                  className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  All In
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-zinc-500 text-base">Bet</span>
                  <span className="font-bold text-xl text-white tabular-nums">
                    {currentBet > 0 ? formatChips(currentBet) : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentBet(0)}
                  className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${currentBet === 0 ? 'invisible' : ''}`}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {isInProgress && (
            <p className="max-w-xs text-center text-sm italic text-zinc-600">
              &quot;{GAMBLING_QUOTES[quoteIdx]}&quot;
            </p>
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? 'Cashed Out' : 'Crashed'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${
                pendingResult.tone === 'win' ? 'text-green-400' : 'text-red-400'
              }`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Bottom: action button — always anchored at the same position */}
        <div className="mx-auto w-full max-w-sm flex flex-col gap-1 pb-2">
          {isBetting && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Start →
              </button>
            </div>
          )}
          {isInProgress && (
            <button
              type="button"
              onClick={handleCashOut}
              className="w-full py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-black rounded-lg text-lg transition-colors shadow-lg"
            >
              Cash Out · {formatMultiplier(displayMult)}
            </button>
          )}
          {isSettled && pendingResult && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleNextCrash}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Next Crash →
              </button>
            </div>
          )}
          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
