'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { buildPendingResult } from '@/lib/game-result-labels'
import { pickQuote } from '@/lib/gambling-quotes'
import { PLINKO_ROWS, computePlinkoPayout, generatePlinkoPath, getSlotMultipliers } from '@/games/plinko/engine'
import {
  SLOT_BAND_HEIGHT,
  SLOT_RECT_Y,
  SLOT_WIDTH,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  getBallX,
  getPinX,
  getPinY,
  slotRectX,
} from '@/games/plinko/board-geometry'
import {
  PLINKO_DROP_STAGGER_MS,
  buildPlinkoDropTrack,
  plinkoDropEndMs,
  samplePlinkoDropTrack,
  type PlinkoDropTrack,
} from '@/games/plinko/drop-animation'
import type { PlinkoOutcome } from '@/games/plinko/types'

/** One ball per drop — spam Drop for rapid low-stake plays. */
const BALLS_PER_DROP = 1
/** Minimum time between quote changes while balls are dropping. */
const PLINKO_QUOTE_COOLDOWN_MS = 5_000
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
  track: PlinkoDropTrack
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

export function PlinkoGame({ mode, bankroll, onBet, onResolve }: PlinkoGameProps) {
  const uid = useId().replace(/:/g, '')
  const ballGlowId = `plinko-ball-${uid}`

  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [sessions, setSessions] = useState<PlinkoSession[]>([])
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [statusHint, setStatusHint] = useState('Place chips — Drop anytime, even while balls are falling.')
  /** Drives per-frame ball interpolation while drops are in flight. */
  const [animNow, setAnimNow] = useState(0)

  const sessionsRef = useRef<PlinkoSession[]>([])
  const lastQuoteRefreshRef = useRef(0)
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
  const ballsInFlight = sessions.length > 0
  const inFlightBalls = sessions.reduce((n, s) => n + s.ballCount, 0)
  const badgeType =
    inFlightBalls > 0
      ? `${inFlightBalls} ball${inFlightBalls === 1 ? '' : 's'} in flight`
      : undefined

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
        const endMs = plinkoDropEndMs(n)

        if (elapsed >= endMs) {
          if (!reportedSessionIdsRef.current.has(s.id)) {
            reportedSessionIdsRef.current.add(s.id)
            completions.push({
              sessionId: s.id,
              betAmount: s.betAmount,
              ballCount: s.ballCount,
              paths: s.balls.map((b) => b.path),
            })
          }
        } else {
          next.push(s)
        }
      }

      if (next.length !== list.length) {
        sessionsRef.current = next
        setSessions(next)
      }

      setAnimNow(now)

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

        const subtitle = `${formatChips(bet)} · ${formatMultiplier(effectiveMultiplier)}`
        const built = buildPendingResult(
          { outcome, betAmount: bet, payout: totalPayout },
          subtitle,
          { winLabel: 'Total winnings', lossLabel: 'No winnings' },
        )
        const entry: MatchHistoryEntry = {
          ...built.entry,
          id: `${c.sessionId}-log`,
          tone:
            outcome === 'push'
              ? 'push'
              : totalPayout > bet
                ? 'win'
                : totalPayout > 0
                  ? 'partial'
                  : 'loss',
        }

        setMatchHistory((prev) => [entry, ...prev].slice(0, 80))
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
    setAnimNow(startedAt)
    const balls: PlinkoBall[] = paths.map((path, ballIndex) => ({
      id: `${id}-b${ballIndex}`,
      path,
      ballIndex,
      track: buildPlinkoDropTrack(path),
    }))
    const session: PlinkoSession = {
      id,
      betAmount: bet,
      ballCount: BALLS_PER_DROP,
      balls,
      startedAt,
    }

    onBetRef.current?.(bet)
    const now = Date.now()
    if (now - lastQuoteRefreshRef.current >= PLINKO_QUOTE_COOLDOWN_MS) {
      lastQuoteRefreshRef.current = now
      setQuoteIdx((prev) => pickQuote(prev))
    }
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
        boardClassName="relative flex min-h-0 flex-col bg-[#111113] px-0 py-2"
        entries={matchHistory}
        gameLabel="Plinko"
        emptyHint="No drops yet — results appear after each ball lands."
      >
        <GameDockBackButton mode={mode} visible={!ballsInFlight} />
        <GameActiveBetBadge
          betAmount={pendingBet}
          betType={badgeType}
          visible={ballsInFlight && pendingBet > 0}
        />

        <div className="flex min-h-0 flex-1 w-full flex-col">
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="min-h-0 w-full flex-1 select-none"
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
                  const elapsed =
                    animNow - session.startedAt - ball.ballIndex * PLINKO_DROP_STAGGER_MS
                  const { x: cx, y: cy } = samplePlinkoDropTrack(ball.track, elapsed)
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

          <div className="min-h-10 flex shrink-0 items-center justify-center px-3">
            <p className="text-center text-xs text-zinc-500">
              {ballsInFlight
                ? 'Balls still dropping — you can queue another drop anytime.'
                : 'Drop sends one ball. Stake chips or reuse your last bet for rapid plays.'}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible
            bankroll={Math.max(0, bankroll - pendingBet)}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={ballsInFlight}
          />

          <div className="h-10 flex items-center justify-center">
            <GameDockBetRow
              currentBet={commitBet}
              onClear={() => {
                setCurrentBet(0)
                setLastBet(0)
              }}
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleDrop}
              disabled={!canDrop}
              className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
            >
              Drop →
            </button>
          </div>

          {minBet > 1 && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
