'use client'

import { useMemo, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { Slider } from '@/components/ui/slider'
import { formatChips, formatMultiplier } from '@/utils/format'
import {
  getPayoutMultiplier,
  getWinProbability,
  getPushProbability,
  initDice,
  resolveDiceRound,
  startDiceRound,
  getDiceResultPayout,
} from '@/games/dice/engine'
import type { DiceSide } from '@/games/dice/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

const SIDES: DiceSide[] = ['under', 'over']

interface DiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface DiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: DiceResult) => void
}

export function DiceGame({ mode, bankroll, onResolve }: DiceGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [threshold, setThreshold] = useState(7)
  const [side, setSide] = useState<DiceSide>('under')
  const [round, setRound] = useState(initDice())
  const [currentBet, setCurrentBet] = useState(0)

  const chance     = useMemo(() => getWinProbability(threshold, side), [threshold, side])
  const pushChance = useMemo(() => getPushProbability(threshold), [threshold])
  const multiplier = useMemo(() => getPayoutMultiplier(threshold, side), [threshold, side])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const canStart     = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
    setRound(startDiceRound(currentBet, threshold, side))
    setCurrentBet(0)
  }

  function handleRoll() {
    const next = resolveDiceRound(round)
    setRound(next)
    if (next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getDiceResultPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initDice())
    setCurrentBet(0)
  }

  const resultPayout = isSettled
    ? round.outcome === 'win' ? getDiceResultPayout(round) : round.outcome === 'push' ? round.betAmount : 0
    : 0

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)' }}>
      {/* Status bar */}
      <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-white/50 border-b border-white/5">
        <span className="font-semibold tracking-widest uppercase text-white/30">Dice Over/Under</span>
        <span>{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 p-4 md:p-6 relative">

        {/* Dice result display */}
        <div className="flex items-center justify-center mb-6 min-h-[120px] relative">
          {isSettled && round.rollResult !== null ? (
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-5xl font-black text-gray-900">{round.rollResult}</span>
              </div>
              <p className="text-white/50 text-sm">
                {round.threshold !== undefined
                  ? `${round.side === 'under' ? 'Under' : 'Over'} ${round.threshold}`
                  : ''}
              </p>
            </div>
          ) : isInProgress && round.rollResult !== null ? (
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-5xl font-black text-gray-900">{round.rollResult}</span>
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl border-2 border-white/20 bg-white/5 flex items-center justify-center mx-auto">
              <span className="text-4xl text-white/20">?</span>
            </div>
          )}

          {/* Result overlay */}
          {isSettled && (
            <div className="absolute inset-0 flex items-end justify-center pb-2">
              <div className="text-center bg-black/60 rounded-xl px-4 py-2">
                <p className={`text-2xl font-black ${round.outcome === 'win' ? 'text-yellow-400' : round.outcome === 'push' ? 'text-white' : 'text-red-400'}`}>
                  {round.outcome === 'win' ? `WIN +${formatChips(resultPayout)}` : round.outcome === 'push' ? 'PUSH' : `LOSS -${formatChips(round.betAmount)}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Config panel (always visible) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <Slider
              label="Threshold"
              min={3}
              max={11}
              step={1}
              value={threshold}
              valueLabel={`${threshold}`}
              onChange={(e) => { if (isBetting) setThreshold(Number(e.currentTarget.value)) }}
            />
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Side</p>
              <div className="flex gap-2">
                {SIDES.map((option) => (
                  <button key={option} onClick={() => { if (isBetting) setSide(option) }}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
                      side === option ? 'bg-white text-gray-900' : 'bg-white/10 text-white/60 hover:bg-white/15'
                    } ${!isBetting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Win chance</span>
              <span className="text-white font-semibold">{(chance * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Push chance</span>
              <span className="text-white font-semibold">{(pushChance * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Payout</span>
              <span className="text-white font-semibold">{formatMultiplier(multiplier)}</span>
            </div>
            {!isBetting && (
              <div className="flex justify-between text-sm pt-1 border-t border-white/10">
                <span className="text-white/50">Bet</span>
                <span className="text-white font-semibold">{formatChips(round.betAmount)}</span>
              </div>
            )}
          </div>
        </div>
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
              Roll Dice
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
