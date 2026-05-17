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
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import {
  getTargetRotation,
  getWheelPayout,
  initWheel,
  spinWheel,
  WHEEL_SEGMENTS,
} from '@/games/wheel/engine'
import type { WheelColor, WheelState } from '@/games/wheel/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

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
  onResolve: (result: WheelResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

export function WheelGame({ mode, bankroll, onResolve }: WheelGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<WheelState>(initWheel())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)

  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotationRef = useRef(0)

  const isBetting    = round.stage === 'betting' && !spinning
  const isSettled    = round.stage === 'settled' && !spinning
  const selectedColor: WheelColor = round.betColor ?? 'red'
  const canSpin = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function setColor(color: WheelColor) {
    if (!isBetting) return
    setRound((prev) => ({ ...prev, betColor: color }))
  }

  function handleSpin() {
    if (!canSpin || spinning) return

    setLastBet(currentBet)
    setSpinning(true)
    setPendingResult(null)

    const result = spinWheel(selectedColor, currentBet)
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

      const tone: MatchHistoryTone = result.outcome === 'win' ? 'win' : 'loss'
      const label = result.outcome === 'win'
        ? `+${formatChips(payout)}`
        : `−${formatChips(result.betAmount)}`
      const entry: MatchHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title: label,
        subtitle: `${formatChips(result.betAmount)} bet · ${result.resultColor} ${result.resultMultiplier}× · bet on ${selectedColor}`,
        tone,
      }
      setPendingResult({ tone, label, entry })
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
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Wheel</span>
        <span className="text-sm text-zinc-600">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4 gap-4"
        entries={matchHistory}
        gameLabel="Wheel"
      >

        {/* Active bet badge */}
        {!isBetting && round.betAmount > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(round.betAmount)}</p>
          </div>
        )}

        {/* Wheel + pointer */}
        <div className="relative flex items-center justify-center">
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

      </GameFieldWithHistory>

      {/* Control zone */}
      <div className={GAME_CONTROL_DOCK_M}>
        {/* Top: variable content */}
        <div className="flex-1 flex flex-col items-center justify-start pt-3 gap-2 min-h-0">

          {isBetting && (
            <div className="w-full max-w-sm flex flex-col gap-2">
              {/* Color picker */}
              <div className="flex gap-2 justify-center">
                {WHEEL_SEGMENTS.map((seg) => {
                  const cs = COLOR_STYLES[seg.color]
                  const isSelected = selectedColor === seg.color
                  return (
                    <button
                      key={seg.color}
                      type="button"
                      onClick={() => setColor(seg.color)}
                      className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all duration-100 ${
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

              {/* Chips */}
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

              {/* Bet display */}
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

          {spinning && (
            <p className="text-sm text-zinc-600 italic">Spinning…</p>
          )}

          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? `${round.resultColor} ${round.resultMultiplier}× — Win` : `${round.resultColor} ${round.resultMultiplier}× — Miss`}
              </p>
              <p className={`text-3xl font-black tabular-nums ${
                pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Bottom: action button */}
        <div className="mx-auto w-full max-w-sm flex flex-col gap-1 pb-2">
          {isBetting && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSpin}
                disabled={!canSpin}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Spin →
              </button>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleNextRound}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Next →
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
