'use client'

import { useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips, formatMultiplier } from '@/utils/format'
import { advanceCrash, cashOutCrash, getCrashPayout, initCrash, startCrashRound } from '@/games/crash/engine'
import type { CrashState } from '@/games/crash/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',       border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',      border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',      border: 'border-zinc-400' },
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

export function CrashGame({ mode, bankroll, onResolve }: CrashGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<CrashState>(initCrash())
  const [currentBet, setCurrentBet] = useState(0)

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const canStart     = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function resolve(next: CrashState) {
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getCrashPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleStart() {
    if (!canStart) return
    setRound(startCrashRound(currentBet))
    setCurrentBet(0)
  }

  function handleRoll() { resolve(advanceCrash(round)) }
  function handleCashOut() { resolve(cashOutCrash(round)) }

  function handleNewRound() {
    setRound(initCrash())
    setCurrentBet(0)
  }

  const multiplierColor =
    round.currentMultiplier >= 5 ? 'text-yellow-300' :
    round.currentMultiplier >= 2 ? 'text-green-400' :
    'text-white'

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)' }}>
      {/* Status bar */}
      <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-white/50 border-b border-white/5">
        <span className="font-semibold tracking-widest uppercase text-white/30">Crash</span>
        <span>{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 p-6 relative flex flex-col items-center justify-center min-h-[240px]">

        {/* Multiplier display */}
        <div className="text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-2">
            {isSettled ? (round.outcome === 'win' ? 'Cashed Out At' : 'Crashed At') : 'Multiplier'}
          </p>
          <p className={`text-7xl sm:text-8xl font-black tabular-nums transition-colors duration-300 ${multiplierColor}`}>
            {isSettled
              ? formatMultiplier(round.outcome === 'win' ? round.payoutMultiplier : round.crashAt)
              : formatMultiplier(round.currentMultiplier)}
          </p>
          {isInProgress && (
            <p className="text-white/40 text-sm mt-3">
              Potential payout: <span className="text-white font-semibold">{formatChips(Math.round(round.betAmount * round.currentMultiplier))}</span>
            </p>
          )}
        </div>

        {/* Crash info grid */}
        {!isBetting && (
          <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Bet</p>
              <p className="text-white font-semibold text-sm">{formatChips(round.betAmount)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Payout</p>
              <p className="text-white font-semibold text-sm">{formatChips(getCrashPayout(round))}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Outcome</p>
              <p className={`font-semibold text-sm capitalize ${round.outcome === 'win' ? 'text-green-400' : round.outcome === 'loss' ? 'text-red-400' : 'text-white'}`}>
                {round.outcome ?? 'Live'}
              </p>
            </div>
          </div>
        )}

        {/* Result overlay */}
        {isSettled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <p className={`text-5xl font-black ${round.outcome === 'win' ? 'text-yellow-400' : 'text-red-400'}`}>
                {round.outcome === 'win' ? 'CASHED OUT' : 'CRASHED'}
              </p>
              <p className="text-white/60 mt-1 text-sm">
                {round.outcome === 'win'
                  ? `+${formatChips(getCrashPayout(round))}`
                  : `-${formatChips(round.betAmount)}`}
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
              Start →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
        </div>

        {/* IN PROGRESS */}
        <div style={{ opacity: isInProgress ? 1 : 0, pointerEvents: isInProgress ? 'auto' : 'none', maxHeight: isInProgress ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-white/50 text-sm">Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span></span>
            <div className="flex gap-2">
              <button onClick={handleRoll} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition-colors">Roll</button>
              <button onClick={handleCashOut} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition-colors">Cash Out</button>
            </div>
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
