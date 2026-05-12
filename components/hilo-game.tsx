'use client'

import { useMemo, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { Slider } from '@/components/ui/slider'
import { formatChips, formatMultiplier } from '@/utils/format'
import { getHiloPayout, initHilo, resolveHiloRound, startHiloRound } from '@/games/hilo/engine'
import type { HiloState } from '@/games/hilo/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

interface HiloResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface HiloGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: HiloResult) => void
}

export function HiloGame({ mode, bankroll, onResolve }: HiloGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [safeZone, setSafeZone] = useState(40)
  const [round, setRound] = useState<HiloState>(initHilo())
  const [currentBet, setCurrentBet] = useState(0)

  const payout      = useMemo(() => getHiloPayout(round), [round])
  const winChance   = useMemo(() => round.safeZone, [round.safeZone])
  const dangerChance = useMemo(() => 100 - round.safeZone, [round.safeZone])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const canStart     = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
    setRound(startHiloRound(currentBet, safeZone))
    setCurrentBet(0)
  }

  function handleRoll() {
    const next = resolveHiloRound(round)
    setRound(next)
    if (next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getHiloPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initHilo())
    setCurrentBet(0)
  }

  // The zone percentage to display in the bar
  const displaySafeZone = isBetting ? safeZone : round.safeZone

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)' }}>
      {/* Status bar */}
      <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-white/50 border-b border-white/5">
        <span className="font-semibold tracking-widest uppercase text-white/30">Hi-Lo</span>
        <span>{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 p-4 md:p-6 relative">

        {/* Roll result display */}
        <div className="flex items-center justify-center mb-6 min-h-[100px]">
          {round.rollResult !== null ? (
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-2xl text-4xl font-black ${
                round.outcome === 'win' ? 'bg-green-500 text-white' : round.outcome === 'loss' ? 'bg-red-500 text-white' : 'bg-white text-gray-900'
              }`}>
                {round.rollResult}
              </div>
              <p className="text-white/50 text-xs mt-2">Rolled</p>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center">
              <span className="text-3xl text-white/20">?</span>
            </div>
          )}
        </div>

        {/* Safe zone visualization */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Safe ({displaySafeZone}%)</span>
            <span>Danger ({100 - displaySafeZone}%)</span>
          </div>
          <div className="relative h-6 rounded-full overflow-hidden bg-red-900/50">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/70 transition-all duration-300"
              style={{ width: `${displaySafeZone}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/80">
              {displaySafeZone}% safe zone
            </div>
          </div>
        </div>

        {/* Config & stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <Slider
              label="Safe zone"
              min={10}
              max={90}
              step={1}
              value={safeZone}
              valueLabel={`${safeZone}%`}
              onChange={(e) => { if (isBetting) setSafeZone(Number(e.currentTarget.value)) }}
            />
          </div>
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Win chance</span>
              <span className="text-white font-semibold">{winChance}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Danger chance</span>
              <span className="text-white font-semibold">{dangerChance}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Payout</span>
              <span className="text-white font-semibold">{formatMultiplier(round.payoutMultiplier)}</span>
            </div>
          </div>
        </div>

        {/* Result overlay */}
        {isSettled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <p className={`text-4xl font-black ${round.outcome === 'win' ? 'text-yellow-400' : 'text-red-400'}`}>
                {round.outcome === 'win' ? 'SAFE' : 'DANGER'}
              </p>
              <p className="text-white/60 mt-1 text-sm">
                {round.outcome === 'win' ? `+${formatChips(payout)}` : `-${formatChips(round.betAmount)}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Control zone ── */}
      <div className="border-t border-white/10 bg-black/30 p-4">

        {/* BETTING */}
        <div style={{ opacity: isBetting ? 1 : 0, pointerEvents: isBetting ? 'auto' : 'none', maxHeight: isBetting ? '160px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="text-white/50 text-sm">Bet</span>
              <span className="font-bold text-lg">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
              {currentBet > 0 && <button onClick={() => setCurrentBet(0)} className="text-white/35 text-xs hover:text-white/70 ml-1 transition-colors">✕ Clear</button>}
            </div>
            <button onClick={handleStart} disabled={!canStart}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/25 text-black font-bold rounded-lg text-sm shadow-lg transition-all">
              Roll →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
        </div>

        {/* IN PROGRESS */}
        <div style={{ opacity: isInProgress ? 1 : 0, pointerEvents: isInProgress ? 'auto' : 'none', maxHeight: isInProgress ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-white/50 text-sm">Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span></span>
            <button onClick={handleRoll} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg">
              Roll
            </button>
          </div>
        </div>

        {/* SETTLED */}
        <div style={{ opacity: isSettled ? 1 : 0, pointerEvents: isSettled ? 'auto' : 'none', maxHeight: isSettled ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}>
          <div className="flex justify-center">
            <button onClick={handleNewRound} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-sm shadow-lg transition-colors">
              New Round →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
