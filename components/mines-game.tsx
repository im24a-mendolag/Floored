'use client'

import { useMemo, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { formatChips, formatMultiplier } from '@/utils/format'
import { cashOutMines, getMinesPayout, initMines, revealMineTile, startMinesRound } from '@/games/mines/engine'
import type { MinesState } from '@/games/mines/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

const DIFFICULTIES: MinesState['difficulty'][] = ['easy', 'medium', 'hard', 'insane']
const DIFFICULTY_LABELS: Record<MinesState['difficulty'], string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', insane: 'Insane',
}

interface MinesResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface MinesGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: MinesResult) => void
}

export function MinesGame({ mode, bankroll, onResolve }: MinesGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [difficulty, setDifficulty] = useState<MinesState['difficulty']>('easy')
  const [round, setRound] = useState<MinesState>(initMines())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)

  const payout    = useMemo(() => getMinesPayout(round), [round])
  const safeCount = useMemo(() => round.remainingSafe, [round.remainingSafe])

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
    setRound(startMinesRound(currentBet, difficulty))
    setCurrentBet(0)
  }

  function handleTileClick(tileId: number) {
    if (round.stage !== 'inProgress') return
    const next = revealMineTile(round, tileId)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getMinesPayout(next),
        multiplier: next.multiplier,
      })
    }
  }

  function handleCashOut() {
    const next = cashOutMines(round)
    setRound(next)
    onResolve({
      outcome: 'win',
      betAmount: next.betAmount,
      payout: getMinesPayout(next),
      multiplier: next.multiplier,
    })
  }

  function handleNewRound() {
    setRound(initMines())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: 'linear-gradient(160deg, #0f4c2a 0%, #0a3d22 100%)' }}>
      {/* Status bar */}
      <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-white/50 border-b border-white/5">
        <span className="font-semibold tracking-widest uppercase text-white/30">Mines</span>
        <span>{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 p-4 md:p-5 relative">

        {/* Stats row */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="bg-black/20 rounded-lg px-3 py-2 text-sm">
            <span className="text-white/40">Safe left </span>
            <span className="text-white font-semibold">{safeCount}</span>
          </div>
          <div className="bg-black/20 rounded-lg px-3 py-2 text-sm">
            <span className="text-white/40">Multiplier </span>
            <span className="text-white font-semibold">{formatMultiplier(round.multiplier)}</span>
          </div>
          <div className="bg-black/20 rounded-lg px-3 py-2 text-sm">
            <span className="text-white/40">Payout </span>
            <span className="text-emerald-400 font-semibold">{formatChips(payout)}</span>
          </div>
        </div>

        {/* Difficulty selector (only available when betting) */}
        <div className="mb-4">
          <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Difficulty</p>
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map((level) => (
              <button key={level} onClick={() => { if (isBetting) setDifficulty(level) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  difficulty === level ? 'bg-white text-gray-900' : 'bg-white/10 text-white/50 hover:bg-white/15'
                } ${!isBetting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Mine grid — always visible */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {round.tiles.length > 0 ? (
            round.tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleTileClick(tile.id)}
                disabled={!isInProgress || tile.revealed}
                className={`h-12 sm:h-14 rounded-lg text-lg font-bold transition-all active:scale-95 ${
                  tile.revealed
                    ? tile.hasMine
                      ? 'bg-red-600 border border-red-400 text-white shadow-lg shadow-red-900/50'
                      : 'bg-emerald-600 border border-emerald-400 text-white shadow-lg shadow-emerald-900/50'
                    : isInProgress
                    ? 'bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 text-white/0 cursor-pointer'
                    : 'bg-white/5 border border-white/10 text-white/0 cursor-default'
                }`}
              >
                {tile.revealed ? (tile.hasMine ? '💣' : '✓') : ''}
              </button>
            ))
          ) : (
            // Placeholder grid before starting
            Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-12 sm:h-14 rounded-lg bg-white/5 border border-white/10" />
            ))
          )}
        </div>

        {/* Result overlay */}
        {isSettled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-none">
            <div className="text-center">
              <p className={`text-4xl font-black ${round.outcome === 'win' ? 'text-yellow-400' : 'text-red-400'}`}>
                {round.outcome === 'win' ? 'CASHED OUT' : 'MINE HIT'}
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
              Start →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
        </div>

        {/* IN PROGRESS */}
        <div style={{ opacity: isInProgress ? 1 : 0, pointerEvents: isInProgress ? 'auto' : 'none', maxHeight: isInProgress ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-white/50 text-sm">
              Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span>
              <span className="text-white/30 mx-2">·</span>
              <span className="text-emerald-400 font-semibold">{formatChips(payout)} if cashed</span>
            </span>
            <button onClick={handleCashOut} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg">
              Cash Out
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
