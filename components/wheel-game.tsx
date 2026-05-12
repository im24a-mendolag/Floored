'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_FRAME,
  GAME_CONTROL_DOCK_L,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { appendPlay } from '@/components/game-history-utils'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { GameOutcomeToast, type GameOutcomeToastSnap } from '@/components/game-outcome-toast'
import { formatChips } from '@/utils/format'
import {
  getTargetRotation,
  getWheelPayout,
  getWinChance,
  initWheel,
  spinWheel,
  WHEEL_SEGMENTS,
} from '@/games/wheel/engine'
import type { WheelColor, WheelState } from '@/games/wheel/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

const COLOR_STYLES: Record<WheelColor, { bg: string; border: string; text: string; ring: string; hex: string }> = {
  red:   { bg: 'bg-red-600',    border: 'border-red-400',    text: 'text-red-300',    ring: 'ring-red-400',    hex: '#ef4444' },
  blue:  { bg: 'bg-blue-600',   border: 'border-blue-400',   text: 'text-blue-300',   ring: 'ring-blue-400',   hex: '#3b82f6' },
  green: { bg: 'bg-emerald-600',border: 'border-emerald-400',text: 'text-emerald-300',ring: 'ring-emerald-400',hex: '#22c55e' },
  gold:  { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-300', ring: 'ring-yellow-400', hex: '#eab308' },
}

const SPIN_DURATION = 2000 // ms

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
  const [wheelToastOpen, setWheelToastOpen] = useState(false)
  const [wheelToastSnap, setWheelToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const lastWheelToastKey = useRef('')

  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotationRef = useRef(0)

  const isBetting = round.stage === 'betting' && !spinning
  const isSettled = round.stage === 'settled' && !spinning
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

    // Calculate result synchronously
    const result = spinWheel(selectedColor, currentBet)
    const target = getTargetRotation(rotationRef.current, result.resultColor!)
    rotationRef.current = target
    setWheelRotation(target)
    setCurrentBet(0)

    spinTimer.current = setTimeout(() => {
      setRound(result)
      setSpinning(false)

      const payout = getWheelPayout(result)
      onResolve({
        outcome: result.outcome!,
        betAmount: result.betAmount,
        payout,
        multiplier: result.payoutMultiplier,
      })
      appendPlay(setMatchHistory, {
        bet: result.betAmount,
        payout,
        mult: result.payoutMultiplier,
        outcome: result.outcome === 'win' ? 'win' : 'loss',
        titlePrefix: result.resultColor ? `${result.resultColor} · ${result.resultMultiplier}×` : 'Wheel',
      })
    }, SPIN_DURATION)
  }

  const handleNewRound = useCallback(() => {
    setRound((prev) => {
      const c = prev.betColor ?? 'red'
      const newState = initWheel()
      newState.betColor = c
      return newState
    })
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  const dismissWheelToast = useCallback(() => {
    setWheelToastOpen(false)
    setWheelToastSnap(null)
  }, [])

  useEffect(() => {
    if (isBetting || spinning) lastWheelToastKey.current = ''
  }, [isBetting, spinning])

  useEffect(() => {
    if (!isSettled || spinning || !round.outcome) return
    const key = `${round.betAmount}-${round.resultColor}-${round.resultMultiplier}-${round.outcome}`
    if (lastWheelToastKey.current === key) return
    lastWheelToastKey.current = key
    const po = getWheelPayout(round)
    const title = round.outcome === 'win' ? 'Win' : 'Miss'
    const subtitle =
      round.outcome === 'win'
        ? `${round.resultMultiplier}× · +${formatChips(po)}`
        : `−${formatChips(round.betAmount)}`
    const tone = round.outcome === 'win' ? 'win' : 'loss'
    setWheelToastSnap({ title, subtitle, tone })
    setWheelToastOpen(true)
    queueMicrotask(() => handleNewRound())
  }, [isSettled, spinning, round.outcome, round.betAmount, round.resultColor, round.resultMultiplier, handleNewRound])
  const conicGradient = `conic-gradient(
    from 0deg,
    #ef4444 0deg 175.6deg,
    #3b82f6 175.6deg 281deg,
    #22c55e 281deg 333.7deg,
    #eab308 333.7deg 360deg
  )`

  return (
    <div className={GAME_CARD_FRAME} style={{ background: 'linear-gradient(160deg, #1a0a1e 0%, #0d0612 100%)' }}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Wheel</span>
        <span className="text-sm text-zinc-600">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative p-4 md:p-6 min-h-0"
        entries={matchHistory}
        gameLabel="Wheel"
      >

        {/* Wheel + pointer */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative flex items-center justify-center">
            {/* Pointer triangle (fixed) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[18px] border-l-transparent border-r-transparent border-b-white drop-shadow-lg" />
            </div>

            {/* Wheel */}
            <div
              className="w-48 h-48 sm:w-56 sm:h-56 rounded-full shadow-2xl border-4 border-white/20 relative overflow-hidden"
              style={{
                background: conicGradient,
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0.8, 0.4, 1)` : 'none',
              }}
            >
              {/* Center cap */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-gray-900 border-2 border-white/30 shadow-inner" />
              </div>

              {/* Segment labels — positioned at each midpoint */}
              {WHEEL_SEGMENTS.map((seg) => {
                const midDeg = { red: 87.8, blue: 228.3, green: 307.35, gold: 346.85 }[seg.color]
                const rad = (midDeg - 90) * (Math.PI / 180)
                const r = 70 // distance from center (px)
                const x = 50 + (r / 112) * 50 * Math.cos(rad)
                const y = 50 + (r / 112) * 50 * Math.sin(rad)
                return (
                  <div
                    key={seg.color}
                    className="absolute text-white font-black text-xs pointer-events-none select-none"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: `translate(-50%, -50%) rotate(${midDeg}deg)`,
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    {seg.multiplier}×
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Segment legend */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {WHEEL_SEGMENTS.map((seg) => {
            const cs = COLOR_STYLES[seg.color]
            const chance = getWinChance(seg.color)
            const isResult = isSettled && round.resultColor === seg.color
            return (
              <div
                key={seg.color}
                className={`rounded-xl border p-2 text-center transition-all ${cs.bg}/20 ${cs.border} ${
                  isResult ? `ring-2 ${cs.ring} scale-105 shadow-lg` : ''
                }`}
              >
                <p className={`font-black text-base ${cs.text}`}>{seg.multiplier}×</p>
                <p className="text-white/40 text-[10px] mt-0.5">{(chance * 100).toFixed(0)}%</p>
              </div>
            )
          })}
        </div>

      </GameFieldWithHistory>

      <GameOutcomeToast
        open={wheelToastOpen && !!wheelToastSnap}
        title={wheelToastSnap?.title ?? ''}
        subtitle={wheelToastSnap?.subtitle}
        tone={wheelToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissWheelToast}
      />

      <div className={GAME_CONTROL_DOCK_L}>
        {isBetting && (
          <div className="relative z-10">
          {/* Color picker row */}
          <div className="mb-3">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Bet on</p>
            <div className="grid grid-cols-4 gap-2">
              {WHEEL_SEGMENTS.map((seg) => {
                const cs = COLOR_STYLES[seg.color]
                const isSelected = selectedColor === seg.color
                return (
                  <button
                    key={seg.color}
                    onClick={() => setColor(seg.color)}
                    className={`py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                      isSelected
                        ? `${cs.bg} ${cs.border} text-white scale-105 shadow-lg`
                        : `${cs.bg}/20 ${cs.border}/40 ${cs.text} hover:${cs.bg}/40`
                    }`}
                  >
                    {seg.multiplier}×
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chips */}
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            {CHIPS.map((chip) => (
              <button key={chip.value} onClick={() => addChip(chip.value)} disabled={chip.value > bankroll - currentBet}
                className={`w-14 h-14 rounded-full ${chip.bg} ${chip.border} border-2 text-white font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed`}>
                {chip.label}
              </button>
            ))}
            <button
              onClick={() => setCurrentBet(bankroll)}
              disabled={currentBet >= bankroll || bankroll <= 0}
              className="h-14 px-3 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 border-2 border-amber-300 text-black font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              All In
            </button>
          </div>

          {/* Bet display + spin */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="text-white/50 text-sm">Bet</span>
              <span className="font-bold text-lg">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
              {currentBet > 0 && (
                <button onClick={() => setCurrentBet(0)} className="text-white/35 text-xs hover:text-white/70 ml-1 transition-colors">✕ Clear</button>
              )}
            </div>
            <button
              onClick={handleSpin}
              disabled={!canSpin}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/25 text-black font-bold rounded-lg text-sm shadow-lg transition-all"
            >
              Spin →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
        </div>
        )}

        {spinning && (
          <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="text-white/50 text-sm animate-pulse">Spinning…</span>
            <span className="text-white/50 text-sm">Bet <span className="text-white font-semibold">{formatChips(round.betAmount > 0 ? round.betAmount : currentBet)}</span></span>
          </div>
          </div>
        )}

      </div>
    </div>
  )
}
