'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_FRAME,
  GAME_CONTROL_DOCK_S,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { appendPlay } from '@/components/game-history-utils'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { GameOutcomeToast, type GameOutcomeToastSnap, type GameOutcomeTone } from '@/components/game-outcome-toast'
import { formatChips } from '@/utils/format'
import { getSlotsResultPayout, initSlots, PAYTABLE, spinSlots } from '@/games/slots/engine'
import type { SlotsState, SlotsSymbol } from '@/games/slots/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

const SYMBOL_DISPLAY: Record<SlotsSymbol, { glyph: string; color: string; bg: string }> = {
  cherry:  { glyph: '🍒', color: 'text-red-400',    bg: 'bg-red-950/60' },
  bar:     { glyph: 'BAR', color: 'text-amber-300',  bg: 'bg-amber-950/60' },
  bell:    { glyph: '🔔', color: 'text-yellow-300',  bg: 'bg-yellow-950/60' },
  diamond: { glyph: '◆',  color: 'text-cyan-300',   bg: 'bg-cyan-950/60' },
  seven:   { glyph: '7',  color: 'text-yellow-400',  bg: 'bg-yellow-900/60' },
  wild:    { glyph: '★',  color: 'text-purple-300',  bg: 'bg-purple-950/60' },
}

const PAYTABLE_GLYPH: Record<SlotsSymbol, string> = {
  cherry: '🍒', bar: 'BAR', bell: '🔔', diamond: '◆', seven: '7', wild: '★',
}

const SPIN_DURATION = 800 // ms

interface SlotsResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface SlotsGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: SlotsResult) => void
}

function Reel({ symbol, spinning, landed }: { symbol: SlotsSymbol | null; spinning: boolean; landed: boolean }) {
  const display = symbol ? SYMBOL_DISPLAY[symbol] : null
  const isBar = symbol === 'bar'
  const isSeven = symbol === 'seven'

  return (
    <div className={`
      relative w-24 h-28 sm:w-28 sm:h-32 rounded-xl border-2 flex items-center justify-center overflow-hidden
      ${spinning ? 'border-white/30 bg-black/40' : 'border-white/20 bg-black/30'}
      transition-colors duration-200
    `}>
      {/* Payline marker */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-yellow-400/30 pointer-events-none" />

      <div className={`
        flex items-center justify-center w-full h-full
        ${spinning ? 'slot-reel-spinning' : ''}
        ${landed && !spinning ? 'slot-reel-landing' : ''}
      `}>
        {spinning || !display ? (
          <span className="text-4xl text-white/20">·</span>
        ) : (
          <div className={`flex flex-col items-center justify-center rounded-lg px-2 py-1 ${display.bg}`}>
            <span className={`
              ${isBar ? 'text-2xl font-black tracking-tight' : 'text-4xl'}
              ${isSeven ? 'text-5xl font-black' : ''}
              ${display.color} leading-none select-none
            `}>
              {display.glyph}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function SlotsGame({ mode, bankroll, onResolve }: SlotsGameProps) {
  const { floorMinBet, jackpotMeter, runActive, resetJackpotMeter } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1
  const jackpotReady = mode === 'survival' && runActive && jackpotMeter >= 100

  const [round, setRound] = useState<SlotsState>(initSlots())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState(false)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [slotsToastOpen, setSlotsToastOpen] = useState(false)
  const [slotsToastSnap, setSlotsToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const lastSlotsToastKey = useRef('')

  const isSettled = round.stage === 'settled' && !spinning
  const canSpin   = currentBet >= minBet && currentBet <= bankroll

  useEffect(() => {
    return () => { if (spinTimer.current) clearTimeout(spinTimer.current) }
  }, [])

  const dismissSlotsToast = useCallback(() => {
    setSlotsToastOpen(false)
    setSlotsToastSnap(null)
  }, [])

  const handleNewRound = useCallback(() => {
    setRound(initSlots())
    setLanded(false)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  useEffect(() => {
    if (spinning) lastSlotsToastKey.current = ''
  }, [spinning])

  useEffect(() => {
    if (!isSettled || !round.outcome) return
    const reelsKey =
      round.reels && round.reels.length >= 3
        ? `${round.reels[0]}-${round.reels[1]}-${round.reels[2]}`
        : ''
    const key = `${round.outcome}-${round.betAmount}-${reelsKey}-${round.isJackpotSpin}`
    if (lastSlotsToastKey.current === key) return
    lastSlotsToastKey.current = key
    const resultPayout = getSlotsResultPayout(round)
    const title = round.isJackpotSpin ? 'Jackpot' : round.outcome === 'win' ? 'Win' : 'No match'
    const subtitle =
      round.outcome === 'win'
        ? `${round.payoutMultiplier}× · +${formatChips(resultPayout)}`
        : `−${formatChips(round.betAmount)}`
    const tone: GameOutcomeTone =
      round.isJackpotSpin || round.outcome === 'win' ? 'win' : 'loss'
    setSlotsToastSnap({ title, subtitle, tone })
    setSlotsToastOpen(true)
    queueMicrotask(() => handleNewRound())
  }, [isSettled, round, round.outcome, round.betAmount, round.reels, round.isJackpotSpin, round.payoutMultiplier, handleNewRound])

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleSpin() {
    if (!canSpin || spinning) return

    setLastBet(currentBet)
    setSpinning(true)
    setLanded(false)

    spinTimer.current = setTimeout(() => {
      const result = spinSlots(currentBet, jackpotReady)
      setRound(result)
      setSpinning(false)
      setLanded(true)
      setCurrentBet(0)

      // Reset jackpot meter in survival store after a jackpot spin
      if (jackpotReady) {
        resetJackpotMeter()
      }

      const payout = getSlotsResultPayout(result)
      onResolve({
        outcome: result.outcome ?? 'loss',
        betAmount: result.betAmount,
        payout,
        multiplier: result.payoutMultiplier,
      })

      const r = result.reels
      const line =
        r && r.length >= 3
          ? `${PAYTABLE_GLYPH[r[0]]} ${PAYTABLE_GLYPH[r[1]]} ${PAYTABLE_GLYPH[r[2]]}`
          : 'Spin'
      appendPlay(setMatchHistory, {
        bet: result.betAmount,
        payout,
        mult: result.payoutMultiplier,
        outcome: result.outcome ?? 'loss',
        titlePrefix: result.isJackpotSpin ? 'Jackpot' : line,
      })

      // Clear landing animation flag after it plays
      setTimeout(() => setLanded(false), 400)
    }, SPIN_DURATION)
  }

  return (
    <div className={GAME_CARD_FRAME} style={{ background: 'linear-gradient(160deg, #1a0a2e 0%, #0d0618 100%)' }}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Slots</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 p-4 md:p-6"
        entries={matchHistory}
        gameLabel="Slots"
      >

        {/* Jackpot meter — survival only */}
        {mode === 'survival' && runActive && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
              <span className="uppercase tracking-wider">Jackpot Meter</span>
              <span className={`font-semibold ${jackpotReady ? 'text-yellow-400 animate-pulse' : 'text-white/60'}`}>
                {jackpotReady ? 'READY — Next spin is 100×!' : `${jackpotMeter}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${jackpotReady ? 'bg-yellow-400' : 'bg-gradient-to-r from-purple-600 to-yellow-400'}`}
                style={{ width: `${jackpotMeter}%` }}
              />
            </div>
          </div>
        )}

        {/* Reels */}
        <div className="flex items-center justify-center gap-3 mb-5">
          {/* Left reel */}
          <Reel symbol={round.reels?.[0] ?? null} spinning={spinning} landed={landed} />

          {/* Center reel */}
          <div className="relative">
            <Reel symbol={round.reels?.[1] ?? null} spinning={spinning} landed={landed} />
            {/* Payline arrows */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-xs">▶</div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-xs">◀</div>
          </div>

          {/* Right reel */}
          <Reel symbol={round.reels?.[2] ?? null} spinning={spinning} landed={landed} />
        </div>

        {/* Paytable — hidden while reels spin to keep field calmer */}
        {!spinning && (
        <div>
          <p className="text-white/25 text-xs uppercase tracking-wider mb-2">Paytable</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {PAYTABLE.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5">
                <div className="flex items-center gap-1.5 text-sm">
                  {row.symbols.slice(0, row.label.startsWith('Two') || row.label.startsWith('Double') ? 2 : 3).map((s, i) => (
                    <span key={i} className={`font-bold text-xs ${SYMBOL_DISPLAY[s].color}`}>
                      {PAYTABLE_GLYPH[s]}
                    </span>
                  ))}
                </div>
                <span className={`font-bold text-sm ${row.multiplier >= 25 ? 'text-yellow-400' : row.multiplier >= 10 ? 'text-emerald-400' : 'text-white/60'}`}>
                  {row.multiplier}×
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-900/30 border border-purple-700/30">
              <span className="text-purple-300 text-xs font-semibold">★ Wild — substitutes any</span>
            </div>
          </div>
        </div>
        )}
      </GameFieldWithHistory>

      <GameOutcomeToast
        open={slotsToastOpen && !!slotsToastSnap}
        title={slotsToastSnap?.title ?? ''}
        subtitle={slotsToastSnap?.subtitle}
        tone={slotsToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissSlotsToast}
      />

      <div className={GAME_CONTROL_DOCK_S}>
        {!spinning && (
          <div className="relative z-10">
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            {CHIPS.map((chip) => (
              <button key={chip.value} onClick={() => addChip(chip.value)}
                disabled={spinning || chip.value > bankroll - currentBet}
                className={`w-14 h-14 rounded-full ${chip.bg} ${chip.border} border-2 text-white font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed`}>
                {chip.label}
              </button>
            ))}
            <button
              onClick={() => setCurrentBet(bankroll)}
              disabled={spinning || currentBet >= bankroll || bankroll <= 0}
              className="h-14 px-3 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 border-2 border-amber-300 text-black font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              All In
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="text-white/50 text-sm">Bet</span>
              <span className="font-bold text-lg">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
              {currentBet > 0 && !spinning && (
                <button onClick={() => setCurrentBet(0)} className="text-white/35 text-xs hover:text-white/70 ml-1 transition-colors">✕ Clear</button>
              )}
            </div>
            <button
              onClick={handleSpin}
              disabled={!canSpin || spinning}
              className={`px-5 py-2 font-bold rounded-lg text-sm shadow-lg transition-all ${
                jackpotReady
                  ? 'bg-yellow-400 hover:bg-yellow-300 text-black animate-pulse'
                  : 'bg-yellow-500 hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/25 text-black'
              }`}
            >
              {spinning ? 'Spinning…' : jackpotReady ? '★ SPIN ★' : 'Spin →'}
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
          </div>
        )}

      </div>
    </div>
  )
}
