'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { PLINKO_ROWS, computePlinkoPayout, generatePlinkoPath, getSlotMultipliers } from '@/games/plinko/engine'
import {
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
  { value: 10, label: '$10', cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25, label: '$25', cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
] as const

const STAGGER_MS = 100
const STEP_MS = 130
/** One ball per drop — spam Drop for rapid low-stake plays. */
const BALLS_PER_DROP = 1
const PIN_R = 5
const BALL_R = 7

/** Solid per-slot color: blue at the high-mult edges, dark at the low-mult center. */
function slotFill(i: number, total: number): string {
  const center = (total - 1) / 2
  const t = Math.abs(i - center) / center
  const r = Math.round(36 + (59 - 36) * t)
  const g = Math.round(36 + (130 - 36) * t)
  const b = Math.round(42 + (246 - 42) * t)
  return `rgb(${r},${g},${b})`
}

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
  onBet?: (amount: number) => void
  onResolve: (result: PlinkoResult) => void
}

function formatSlotMult(m: number): string {
  if (Number.isInteger(m)) return `${m}x`
  return `${m}x`
}

function maxEndMs(ballCount: number) {
  return (ballCount - 1) * STAGGER_MS + PLINKO_ROWS * STEP_MS
}

export function PlinkoGame({ mode, bankroll, onBet, onResolve }: PlinkoGameProps) {
  const uid = useId().replace(/:/g, '')
  const ballGlowId = `plinko-ball-${uid}`

  const router = useRouter()
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
  const onBetRef = useRef(onBet)
  onBetRef.current = onBet

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

        onResolveRef.current({
          outcome,
          betAmount: bet,
          payout: totalPayout,
          multiplier: effectiveMultiplier,
        })

        let title: string
        let tone: MatchHistoryTone
        const netPL = totalPayout - bet
        if (outcome === 'win') {
          title = `+${formatChips(netPL)}`
          tone = 'win'
        } else if (outcome === 'push') {
          title = `Push`
          tone = 'push'
        } else if (totalPayout > 0) {
          title = `−${formatChips(Math.abs(netPL))}`
          tone = 'partial'
        } else {
          title = `−${formatChips(bet)}`
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
  }, [])

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

    onBetRef.current?.(bet)
    setLastBet(bet)
    if (currentBet >= minBet) setCurrentBet(0)

    // Update ref synchronously so the animation loop sees the session immediately
    const merged = [...sessionsRef.current, session]
    sessionsRef.current = merged
    setSessions(merged)

    const n = merged.length
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
        boardClassName="relative flex flex-col min-h-0 bg-[#111113]"
        entries={matchHistory}
        gameLabel="Plinko"
        emptyHint="No drops yet — results appear after each ball lands."
      >
          {sessions.length === 0 && (
            <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
              ← Back
            </button>
          )}
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="flex-1 min-h-0 w-full select-none"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
              <defs>
                <filter id={ballGlowId} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Board background */}
              <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#111113" />

              {Array.from({ length: PLINKO_ROWS }, (_, row) =>
                Array.from({ length: row + 1 }, (_, col) => (
                  <circle key={`pin-${row}-${col}`} cx={getPinX(row, col)} cy={getPinY(row)} r={PIN_R} fill="#71717a" />
                )),
              )}

              {slots.map((mult, i) => (
                <g key={`slot-${i}`}>
                  <rect
                    x={slotRectX(i)}
                    y={SLOT_RECT_Y}
                    width={SLOT_WIDTH}
                    height={SLOT_BAND_HEIGHT}
                    fill={slotFill(i, slots.length)}
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={1}
                  />
                  <text
                    x={getBallX(0, i)}
                    y={SLOT_RECT_Y + SLOT_BAND_HEIGHT / 2 + 5}
                    textAnchor="middle"
                    fill="white"
                    fontWeight="bold"
                    style={{ fontSize: 11 }}
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
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
          <div className="space-y-0 pb-2 pt-3">
            <div className="flex flex-nowrap justify-center gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => addChip(chip.value)}
                  disabled={chip.value > bankroll - pendingBet - currentBet}
                  className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addChip(Math.floor(bankroll / 4))}
                disabled={currentBet >= bankroll - pendingBet || bankroll - pendingBet <= 0}
                className="h-12 px-3 rounded-full bg-blue-100 hover:bg-blue-50 border-2 border-blue-200 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                ¼
              </button>
              <button
                type="button"
                onClick={() => addChip(Math.floor(bankroll / 2))}
                disabled={currentBet >= bankroll - pendingBet || bankroll - pendingBet <= 0}
                className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                ½
              </button>
              <button
                type="button"
                onClick={() => setCurrentBet(Math.max(0, bankroll - pendingBet))}
                disabled={currentBet >= bankroll - pendingBet || bankroll <= 0}
                className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                All In
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Bet</span>
                <span className="font-bold text-xl text-white">
                  {commitBet > 0 ? formatChips(commitBet) : '—'}
                </span>
                {commitBet > 0 && (
                  <button
                    type="button"
                    onClick={() => { setCurrentBet(0); setLastBet(0) }}
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
          </div>
        </div>
    </div>
  )
}
