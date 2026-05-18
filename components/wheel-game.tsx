'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_CARD_SHELL,
  GAME_BOARD_ARENA,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import { buildPendingResult } from '@/lib/game-result-labels'
import { pickQuote } from '@/lib/gambling-quotes'
import {
  getTargetRotation,
  getWheelPayout,
  initWheel,
  spinWheel,
  WHEEL_SEGMENTS,
} from '@/games/wheel/engine'
import type { WheelColor, WheelState } from '@/games/wheel/types'

const COLOR_STYLES: Record<WheelColor, { bg: string; border: string; text: string; ring: string }> = {
  red:   { bg: 'bg-red-600',     border: 'border-red-400',     text: 'text-red-300',     ring: 'ring-red-400'     },
  blue:  { bg: 'bg-blue-600',    border: 'border-blue-400',    text: 'text-blue-300',    ring: 'ring-blue-400'    },
  green: { bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400' },
  gold:  { bg: 'bg-yellow-500',  border: 'border-yellow-400',  text: 'text-yellow-300',  ring: 'ring-yellow-400'  },
}

const SPIN_DURATION = 2000

// 12 equal slices: 6 red · 3 blue · 2 green · 1 gold
const TOTAL_SLICES = 12
const SLICE_DEG = 360 / TOTAL_SLICES

const HEX: Record<WheelColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', gold: '#eab308',
}

// Bresenham-style spread: places each color evenly across all 41 positions
// instead of grouping them, so the wheel looks visually mixed
function makeMixedSlices(): WheelColor[] {
  const quota: Record<WheelColor, number> = { red: 6, blue: 3, green: 2, gold: 1 }
  const placed: Record<WheelColor, number> = { red: 0, blue: 0, green: 0, gold: 0 }
  const order: WheelColor[] = ['red', 'blue', 'green', 'gold']
  const out: WheelColor[] = []
  for (let i = 0; i < TOTAL_SLICES; i++) {
    let best: WheelColor = 'red'
    let bestScore = -Infinity
    for (const c of order) {
      if (placed[c] >= quota[c]) continue
      const score = quota[c] * (i + 1) / TOTAL_SLICES - placed[c]
      if (score > bestScore) { bestScore = score; best = c }
    }
    out.push(best)
    placed[best]++
  }
  return out
}

const SLICE_COLORS: WheelColor[] = makeMixedSlices()

function slicePath(i: number, cx: number, cy: number, r: number): string {
  const a0 = (i * SLICE_DEG - 90) * (Math.PI / 180)
  const a1 = ((i + 1) * SLICE_DEG - 90) * (Math.PI / 180)
  const x0 = (cx + r * Math.cos(a0)).toFixed(3)
  const y0 = (cy + r * Math.sin(a0)).toFixed(3)
  const x1 = (cx + r * Math.cos(a1)).toFixed(3)
  const y1 = (cy + r * Math.sin(a1)).toFixed(3)
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`
}

interface WheelResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface WheelGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: (result: WheelResult) => void
}

interface PendingResult {
  tone: 'win' | 'loss'
  label: string
  outcomeLabel: string
  entry: MatchHistoryEntry
}

function wheelColorLabel(color: WheelColor) {
  const seg = WHEEL_SEGMENTS.find((s) => s.color === color)
  const name = color.charAt(0).toUpperCase() + color.slice(1)
  return seg ? `${name} ${seg.multiplier}×` : name
}

function wheelColorMultiplier(color: WheelColor) {
  return WHEEL_SEGMENTS.find((s) => s.color === color)?.multiplier ?? 2
}

export function WheelGame({ mode, bankroll, onBet, onResolve }: WheelGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<WheelState>(initWheel())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [activeBet, setActiveBet] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotationRef = useRef(0)

  const isBetting    = round.stage === 'betting' && !spinning
  const isSettled    = round.stage === 'settled' && !spinning
  const selectedColor: WheelColor = round.betColor ?? 'red'
  const canSpin = currentBet >= minBet && currentBet <= bankroll
  const potentialWinnings =
    isBetting && currentBet > 0
      ? Math.round(currentBet * wheelColorMultiplier(selectedColor))
      : (spinning || isSettled) && activeBet > 0
        ? Math.round(activeBet * wheelColorMultiplier(round.betColor ?? selectedColor))
        : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function setColor(color: WheelColor) {
    if (!isBetting) return
    setRound((prev) => ({ ...prev, betColor: color }))
  }

  function handleSpin() {
    if (!canSpin || spinning) return

    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setActiveBet(bet)
    setSpinning(true)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))

    const result = spinWheel(selectedColor, bet)
    const target = getTargetRotation(rotationRef.current, result.resultColor!)
    rotationRef.current = target
    setWheelRotation(target)
    setCurrentBet(0)

    spinTimer.current = setTimeout(() => {
      setSpinning(false)
      setRound(result)

      const payout = getWheelPayout(result)
      onResolve({
        outcome: result.outcome!,
        betAmount: result.betAmount,
        payout,
        multiplier: result.payoutMultiplier,
      })

      const built = buildPendingResult(
        { outcome: result.outcome!, betAmount: result.betAmount, payout },
        `${formatChips(result.betAmount)} bet · ${result.resultColor} ${result.resultMultiplier}×`,
        { winLabel: 'Total winnings', lossLabel: 'No winnings' },
      )
      setPendingResult({
        tone: built.tone === 'win' ? 'win' : 'loss',
        label: built.label,
        outcomeLabel: `${result.resultColor} ${result.resultMultiplier}× — ${result.outcome === 'win' ? 'Win' : 'Miss'}`,
        entry: built.entry,
      })
    }, SPIN_DURATION)
  }

  const handleNewRound = useCallback(() => {
    if (spinTimer.current) clearTimeout(spinTimer.current)
    setRound((prev) => {
      const c = prev.betColor ?? 'red'
      const s = initWheel()
      s.betColor = c
      return s
    })
    setPendingResult(null)
    setActiveBet(0)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNextRound() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    }
    handleNewRound()
  }

  useEffect(() => () => { if (spinTimer.current) clearTimeout(spinTimer.current) }, [])

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Fortune Wheel</span>
        <span className="text-sm text-zinc-600">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4 gap-4"
        entries={matchHistory}
        gameLabel="Fortune Wheel"
      >

        <GameDockBackButton mode={mode} visible={isBetting} />
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={activeBet > 0 && !isBetting ? wheelColorLabel(round.betColor ?? selectedColor) : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="flex flex-col items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center shrink-0">
          {/* Pointer — fixed above the wheel, points downward */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
          </div>

          {/* SVG wheel — 41 equal slices */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full shadow-2xl border-4 border-white/20 overflow-hidden">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0.8, 0.4, 1)`
                  : 'none',
              }}
            >
              {/* Slices */}
              {SLICE_COLORS.map((color, i) => (
                <path
                  key={i}
                  d={slicePath(i, 100, 100, 96)}
                  fill={HEX[color]}
                  stroke="#000"
                  strokeWidth="0.5"
                />
              ))}

              {/* Center cap */}
              <circle cx="100" cy="100" r="13" fill="#09090b" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

          <div className="min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
            <p className="text-center text-xs text-zinc-500">
              {isBetting
                ? 'Pick a color multiplier, place chips, then spin.'
                : spinning
                  ? 'Wheel spinning…'
                  : '\u00A0'}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={`${GAME_DOCK_INNER} min-h-[248px]`}>
          <div className={`flex justify-center min-h-10 ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
            <div className="flex gap-2">
              {WHEEL_SEGMENTS.map((seg) => {
                const cs = COLOR_STYLES[seg.color]
                const isSelected = selectedColor === seg.color
                return (
                  <button
                    key={seg.color}
                    type="button"
                    onClick={() => setColor(seg.color)}
                    className={`px-5 py-1.5 rounded-xl border-2 font-bold text-sm transition-all duration-100 ${
                      isSelected
                        ? `${cs.bg} ${cs.border} text-white shadow-lg scale-105`
                        : `${cs.border} ${cs.text} opacity-40 hover:opacity-70`
                    }`}
                  >
                    {seg.multiplier}×
                  </button>
                )
              })}
            </div>
          </div>

          <GameDockChipRow
            visible={isBetting || spinning}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={spinning}
          />

          <div className="h-10 flex items-center justify-center">
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {spinning && potentialWinnings > 0 && (
              <p className="text-sm text-zinc-400">
                Potential total winnings:{' '}
                <span className="font-semibold text-emerald-400">{formatChips(potentialWinnings)}</span>
              </p>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                outcomeLabel={pendingResult.outcomeLabel}
                label={pendingResult.label}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !spinning && !(isSettled && pendingResult) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={isSettled ? handleNextRound : handleSpin}
                disabled={!isSettled && (!canSpin || spinning)}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                {isSettled ? 'Next →' : spinning ? 'Spinning…' : 'Spin →'}
              </button>
            </div>
            {minBet > 1 && isBetting && (
              <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
