'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { PLINKO_ROWS, computePlinkoPayout, generatePlinkoPath, getSlotMultipliers } from '@/games/plinko/engine'
import {
  BOARD_MARGIN,
  SLOT_BAND_HEIGHT,
  SLOT_RECT_Y,
  SLOT_WIDTH,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  getBallCenterY,
  getBallX,
  getPinX,
  getPinY,
  slotRectX,
} from '@/games/plinko/board-geometry'
import type { PlinkoOutcome } from '@/games/plinko/types'

const CHIPS = [
  { value: 10, label: '$10', cls: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' },
  { value: 25, label: '$25', cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
] as const

const STAGGER_MS = 100
const STEP_MS = 130
/** One ball per drop — spam Drop for rapid low-stake plays. */
const BALLS_PER_DROP = 1
const PIN_R = 4
const BALL_R = 9

interface PlinkoBall {
  id: string
  path: number[]
  ballIndex: number
  currentStep: number
}

interface PlinkoSession {
  id: string
  betAmount: number
  ballCount: number
  balls: PlinkoBall[]
  startedAt: number
}

interface PlinkoResult {
  outcome: PlinkoOutcome
  betAmount: number
  payout: number
  multiplier: number
}

interface PlinkoGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: PlinkoResult) => void
}

function formatSlotMult(m: number): string {
  if (Number.isInteger(m)) return `${m}x`
  return `${m}x`
}

function maxEndMs(ballCount: number) {
  return (ballCount - 1) * STAGGER_MS + PLINKO_ROWS * STEP_MS
}

export function PlinkoGame({ mode, bankroll, onResolve }: PlinkoGameProps) {
  const uid = useId().replace(/:/g, '')
  const slotGradId = `plinko-slot-${uid}`
  const ballGlowId = `plinko-ball-${uid}`

  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [sessions, setSessions] = useState<PlinkoSession[]>([])
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [statusHint, setStatusHint] = useState('Place chips — Drop anytime, even while balls are falling.')

  const sessionsRef = useRef<PlinkoSession[]>([])
  const rafRef = useRef<number | null>(null)
  const reportedSessionIdsRef = useRef<Set<string>>(new Set())
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  const lastBetRef = useRef(lastBet)
  const bankrollRef = useRef(bankroll)
  const autoReBetRef = useRef(autoReBet)
  lastBetRef.current = lastBet
  bankrollRef.current = bankroll
  autoReBetRef.current = autoReBet

  const slots = useMemo(() => getSlotMultipliers(), [])

  const pendingBet = useMemo(() => sessions.reduce((a, s) => a + s.betAmount, 0), [sessions])

  /** Staged chips, or last stake for rapid repeat drops while balls are in flight. */
  const commitBet = useMemo(() => {
    if (currentBet >= minBet) return currentBet
    if (lastBet >= minBet) return lastBet
    return 0
  }, [currentBet, lastBet, minBet])

  const canDrop = commitBet >= minBet && commitBet + pendingBet <= bankroll && bankroll > 0

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const kickLoop = useCallback(() => {
    if (rafRef.current != null) return

    const tick = (now: number) => {
      const list = sessionsRef.current
      if (list.length === 0) {
        rafRef.current = null
        setStatusHint('Place chips — Drop anytime, even while balls are falling.')
        return
      }

      const completions: {
        sessionId: string
        betAmount: number
        ballCount: number
        paths: number[][]
      }[] = []

      const next: PlinkoSession[] = []

      for (const s of list) {
        const elapsed = now - s.startedAt
        const n = s.balls.length
        const endMs = maxEndMs(n)
        const newBalls = s.balls.map((b) => {
          const t = elapsed - b.ballIndex * STAGGER_MS
          const step = t < 0 ? 0 : Math.min(PLINKO_ROWS, Math.floor(t / STEP_MS))
          return { ...b, currentStep: step }
        })

        if (elapsed >= endMs) {
          if (!reportedSessionIdsRef.current.has(s.id)) {
            reportedSessionIdsRef.current.add(s.id)
            completions.push({
              sessionId: s.id,
              betAmount: s.betAmount,
              ballCount: s.ballCount,
              paths: newBalls.map((b) => b.path),
            })
          }
        } else {
          next.push({ ...s, balls: newBalls })
        }
      }

      const changed =
        next.length !== list.length ||
        next.some((s, si) => {
          const o = list[si]
          if (!o || s.id !== o.id) return true
          return s.balls.some((b, bi) => b.currentStep !== o.balls[bi]?.currentStep)
        })

      if (changed) {
        sessionsRef.current = next
        setSessions(next)
      }

      for (const c of completions) {
        const result = computePlinkoPayout(c.betAmount, c.ballCount, c.paths)
        const { totalPayout, outcome, effectiveMultiplier } = result
        const bet = c.betAmount
        const net = bet - totalPayout

        onResolveRef.current({
          outcome,
          betAmount: bet,
          payout: totalPayout,
          multiplier: effectiveMultiplier,
        })

        let title: string
        let tone: MatchHistoryTone
        if (outcome === 'win') {
          title = `+${formatChips(totalPayout)}`
          tone = 'win'
        } else if (outcome === 'push') {
          title = `Push ${formatChips(totalPayout)}`
          tone = 'push'
        } else if (totalPayout > 0) {
          title = `+${formatChips(totalPayout)} · net −${formatChips(net)}`
          tone = 'partial'
        } else {
          title = `Lost ${formatChips(bet)}`
          tone = 'loss'
        }

        const subtitle = `${formatChips(bet)} bet · ${formatMultiplier(effectiveMultiplier)}`

        setMatchHistory((prev) =>
          [
            {
              id: `${c.sessionId}-log`,
              at: new Date(),
              title,
              subtitle,
              tone,
            },
            ...prev,
          ].slice(0, 80),
        )
      }

      if (completions.length) {
        const remaining = sessionsRef.current.length
        setStatusHint(
          remaining > 0
            ? `${remaining} drop${remaining === 1 ? '' : 's'} in flight…`
            : 'Round finished — bet again or drop again.',
        )
        if (remaining === 0 && autoReBetRef.current) {
          const cap = bankrollRef.current
          setCurrentBet(() => Math.min(lastBetRef.current, cap))
        }
      }

      if (sessionsRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop])

  useEffect(() => {
    return () => stopLoop()
  }, [stopLoop])

  const addChip = useCallback(
    (value: number) => {
      setCurrentBet((prev) => Math.min(prev + value, Math.max(0, bankroll - pendingBet)))
    },
    [bankroll, pendingBet],
  )

  const handleDrop = useCallback(() => {
    const bet =
      currentBet >= minBet ? currentBet : lastBet >= minBet ? lastBet : 0
    if (bet < minBet || bet + pendingBet > bankroll) return

    const paths = generatePlinkoPath(BALLS_PER_DROP)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const startedAt = performance.now()
    const balls: PlinkoBall[] = paths.map((path, ballIndex) => ({
      id: `${id}-b${ballIndex}`,
      path,
      ballIndex,
      currentStep: 0,
    }))
    const session: PlinkoSession = {
      id,
      betAmount: bet,
      ballCount: BALLS_PER_DROP,
      balls,
      startedAt,
    }

    setLastBet(bet)
    if (currentBet >= minBet) setCurrentBet(0)

    setSessions((prev) => {
      const merged = [...prev, session]
      sessionsRef.current = merged
      return merged
    })
    const n = sessionsRef.current.length
    setStatusHint(`${n} ball${n === 1 ? '' : 's'} in flight — keep dropping if you like.`)
    kickLoop()
  }, [bankroll, currentBet, kickLoop, lastBet, minBet, pendingBet])

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Plinko</span>
        <span className="text-sm text-zinc-600 truncate max-w-[60%] text-right">{statusHint}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 items-center justify-center"
        entries={matchHistory}
        gameLabel="Plinko"
        emptyHint="No drops yet — results appear after each ball lands."
      >
        <div className="absolute inset-0 flex items-center justify-center px-4 py-3">
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="h-full w-full max-h-full select-none"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
              <defs>
                <linearGradient
                  id={slotGradId}
                  x1={BOARD_MARGIN}
                  y1="0"
                  x2={VIEWBOX_WIDTH - BOARD_MARGIN}
                  y2="0"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#27272a" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <filter id={ballGlowId} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {Array.from({ length: PLINKO_ROWS }, (_, row) =>
                Array.from({ length: row + 1 }, (_, col) => (
                  <circle key={`pin-${row}-${col}`} cx={getPinX(row, col)} cy={getPinY(row)} r={PIN_R} fill="#3f3f46" />
                )),
              )}

              {slots.map((mult, i) => (
                <g key={`slot-${i}`}>
                  <rect
                    x={slotRectX(i)}
                    y={SLOT_RECT_Y}
                    width={SLOT_WIDTH}
                    height={SLOT_BAND_HEIGHT}
                    fill={`url(#${slotGradId})`}
                    stroke="#27272a"
                    strokeWidth={1}
                  />
                  <text
                    x={getBallX(0, i)}
                    y={SLOT_RECT_Y + SLOT_BAND_HEIGHT / 2 + 5}
                    textAnchor="middle"
                    className="fill-zinc-300 font-bold"
                    style={{ fontSize: 15 }}
                  >
                    {formatSlotMult(mult)}
                  </text>
                </g>
              ))}

              {sessions.flatMap((session) =>
                session.balls.map((ball) => {
                  const step = Math.min(ball.currentStep, ball.path.length - 1)
                  const slotIdx = ball.path[step] ?? 0
                  const cx = getBallX(step, slotIdx)
                  const cy = getBallCenterY(step)
                  return (
                    <circle
                      key={`${session.id}-${ball.id}`}
                      cx={cx}
                      cy={cy}
                      r={BALL_R}
                      fill="#fafafa"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      filter={`url(#${ballGlowId})`}
                    />
                  )
                }),
              )}
            </svg>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap justify-center">
              {CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => addChip(chip.value)}
                  disabled={chip.value > bankroll - pendingBet - currentBet}
                  className={`w-14 h-14 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentBet(Math.max(0, bankroll - pendingBet))}
                disabled={currentBet >= bankroll - pendingBet || bankroll <= 0}
                className="h-14 px-4 rounded-full bg-zinc-200 hover:bg-white border-2 border-zinc-100 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                All In
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Bet</span>
                <span className="font-bold text-xl text-white">
                  {commitBet > 0 ? formatChips(commitBet) : '—'}
                </span>
                {currentBet < minBet && lastBet >= minBet && commitBet > 0 && (
                  <span className="text-xs text-zinc-500 font-normal ml-1">(repeat)</span>
                )}
                {currentBet > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentBet(0)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleDrop}
                disabled={!canDrop}
                className="px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Drop →
              </button>
            </div>
            {minBet > 1 && <p className="text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>}
            {sessions.length === 0 && pendingBet === 0 && (
            <p className="text-zinc-600 text-xs">
              Each row is a fair 50/50. The sim uses a Galton (binomial) slot model so the grid center hits most often — fewer 10×/5× than with a wall-clamped walk.
            </p>
            )}
          </div>
        </div>
    </div>
  )
}
