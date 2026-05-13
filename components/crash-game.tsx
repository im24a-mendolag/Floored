'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { GameOutcomeToast, type GameOutcomeToastSnap } from '@/components/game-outcome-toast'
import { formatChips, formatMultiplier } from '@/utils/format'
import { computeMultiplier, initCrash, startCrashRound } from '@/games/crash/engine'
import type { CrashState } from '@/games/crash/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' },
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
  onResolve: (result: CrashResult) => void
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

export function CrashGame({ mode, bankroll, onResolve }: CrashGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound]         = useState<CrashState>(initCrash())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet]     = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [resultToastOpen, setResultToastOpen] = useState(false)
  const [crashToastSnap, setCrashToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])

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
        setMatchHistory((h) =>
          [
            {
              id: `${Date.now()}-crash-${Math.random().toString(36).slice(2)}`,
              at: new Date(),
              title: `Crashed ${formatMultiplier(crashAt)} · −${formatChips(betAmount)}`,
              subtitle: `${formatChips(betAmount)} staked`,
              tone: 'loss' as const,
            },
            ...h,
          ].slice(0, 80),
        )
        setCrashToastSnap({
          title: 'CRASHED',
          subtitle: `-${formatChips(betAmount)}`,
          tone: 'loss',
        })
        setTimeout(() => {
          setResultToastOpen(true)
          handleNewRound()
        }, 300)
      }
    }, 50)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInProgress, handleNewRound])

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
    setLastBet(currentBet)
    setElapsedMs(0)
    setResultToastOpen(false)
    setCrashToastSnap(null)
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
    setMatchHistory((h) =>
      [
        {
          id: `${Date.now()}-crash-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: `+${formatChips(payout)} @ ${formatMultiplier(m)}`,
          subtitle: `${formatChips(round.betAmount)} bet`,
          tone: 'win' as const,
        },
        ...h,
      ].slice(0, 80),
    )
    setCrashToastSnap({
      title: 'CASHED OUT',
      subtitle: `+${formatChips(payout)}`,
      tone: 'win',
    })
    setTimeout(() => {
      setResultToastOpen(true)
      handleNewRound()
    }, 200)
  }

  const dismissResultToast = useCallback(() => {
    setResultToastOpen(false)
    setCrashToastSnap(null)
  }, [])

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
              {isInProgress && (
                <p className="text-zinc-500 text-sm mt-2">
                  Potential{' '}
                  <span className="text-zinc-300 font-semibold">
                    {formatChips(Math.round(round.betAmount * displayMult))}
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      </GameFieldWithHistory>

      <GameOutcomeToast
        open={resultToastOpen && !!crashToastSnap}
        title={crashToastSnap?.title ?? ''}
        subtitle={crashToastSnap?.subtitle}
        tone={crashToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissResultToast}
      />

      {/* Control zone — shared max width so bet line and actions share one vertical axis */}
      <div className={GAME_CONTROL_DOCK_M}>
        {isBetting && (
          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col gap-3">
            <div className="flex flex-wrap justify-center gap-3">
              {CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => addChip(chip.value)}
                  disabled={chip.value > bankroll - currentBet}
                  className={`w-14 h-14 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentBet(bankroll)}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className="h-14 px-4 rounded-full bg-zinc-200 hover:bg-white border-2 border-zinc-100 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                All In
              </button>
            </div>
            <div className="flex items-center justify-center">
              <div className="grid w-full max-w-[280px] grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                <div className="min-w-0" aria-hidden />
                <div className="flex items-center justify-center gap-2.5 whitespace-nowrap">
                  <span className="text-zinc-500 text-base">Bet</span>
                  <span className="font-bold text-xl text-white tabular-nums">
                    {currentBet > 0 ? formatChips(currentBet) : '—'}
                  </span>
                </div>
                <div className="flex min-h-[2.25rem] items-center justify-end">
                  {currentBet > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentBet(0)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
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
            {minBet > 1 && <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>}
          </div>
        )}

        {isInProgress && (
          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col gap-3">
            <button
              type="button"
              onClick={handleCashOut}
              className="w-full py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-black rounded-lg text-lg transition-colors shadow-lg"
            >
              Cash Out · {formatMultiplier(displayMult)}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
