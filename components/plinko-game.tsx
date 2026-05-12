'use client'

import { useMemo, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { formatChips } from '@/utils/format'
import { getSlotMultipliers, getPlinkoPayout, initPlinko, resolvePlinkoRound, startPlinkoRound } from '@/games/plinko/engine'
import type { PlinkoState } from '@/games/plinko/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

interface PlinkoResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface PlinkoGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: PlinkoResult) => void
}

function slotColor(multiplier: number): string {
  if (multiplier === 0)   return 'bg-red-900/80 border-red-700 text-red-300'
  if (multiplier >= 5)    return 'bg-yellow-600/80 border-yellow-400 text-yellow-200'
  if (multiplier >= 2)    return 'bg-emerald-700/80 border-emerald-500 text-emerald-200'
  return 'bg-white/10 border-white/20 text-white/70'
}

export function PlinkoGame({ mode, bankroll, onResolve }: PlinkoGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<PlinkoState>(initPlinko())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const slots = useMemo(() => getSlotMultipliers(), [])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const canStart     = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
    setLastBet(currentBet)
    setRound(startPlinkoRound(currentBet))
    setCurrentBet(0)
  }

  function handleDrop() {
    const next = resolvePlinkoRound(round)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getPlinkoPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initPlinko())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: 'linear-gradient(160deg, #0d1b3e 0%, #070e24 100%)' }}>
      {/* Status bar */}
      <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-white/50 border-b border-white/5">
        <span className="font-semibold tracking-widest uppercase text-white/30">Plinko</span>
        <span>{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 p-4 md:p-6 relative">

        {/* Puck / path display */}
        <div className="flex items-center justify-center mb-6 min-h-[80px]">
          {round.path.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap justify-center max-w-xs">
              {round.path.map((pos, i) => (
                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i === round.path.length - 1 ? 'bg-yellow-400 text-black scale-110 shadow-lg' : 'bg-white/20 text-white/60'
                }`}>
                  {pos}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-yellow-400/60" />
              </div>
              <p className="text-white/30 text-sm ml-3">Drop a puck to play</p>
            </div>
          )}
        </div>

        {/* Slot multiplier display — always visible */}
        <div>
          <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Slots</p>
          <div className="grid grid-cols-7 gap-1.5">
            {slots.map((multiplier, index) => (
              <div
                key={index}
                className={`rounded-lg border px-1 py-2 text-center text-xs font-bold transition-all ${slotColor(multiplier)} ${
                  isSettled && round.finalSlot === index ? 'ring-2 ring-yellow-400 scale-110 shadow-lg shadow-yellow-900/50' : ''
                }`}
              >
                <p className="text-white/40 text-[10px] leading-none mb-0.5">{index}</p>
                <p>{multiplier === 0 ? 'L' : `${multiplier}x`}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {!isBetting && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Bet</p>
              <p className="text-white font-semibold text-sm">{formatChips(round.betAmount)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Slot</p>
              <p className="text-white font-semibold text-sm">{round.finalSlot ?? '—'}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Payout</p>
              <p className="text-white font-semibold text-sm">{isSettled ? formatChips(getPlinkoPayout(round)) : '—'}</p>
            </div>
          </div>
        )}

        {/* Result overlay */}
        {isSettled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <p className={`text-4xl font-black ${round.outcome === 'win' ? 'text-yellow-400' : round.outcome === 'push' ? 'text-white' : 'text-red-400'}`}>
                {round.outcome === 'win' ? 'WIN' : round.outcome === 'push' ? 'PUSH' : 'LOSE'}
              </p>
              <p className="text-white/60 mt-1 text-sm">
                Slot {round.finalSlot} · {round.payoutMultiplier}x
                {round.outcome === 'win' && ` · +${formatChips(getPlinkoPayout(round))}`}
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
              Drop →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
        </div>

        {/* IN PROGRESS */}
        <div style={{ opacity: isInProgress ? 1 : 0, pointerEvents: isInProgress ? 'auto' : 'none', maxHeight: isInProgress ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-white/50 text-sm">Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span></span>
            <button onClick={handleDrop} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-sm transition-colors shadow-lg">
              Drop Puck
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
