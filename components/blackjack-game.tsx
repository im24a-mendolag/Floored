'use client'

import { useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import type { BlackjackCard, BlackjackOutcome, BlackjackState } from '@/games/blackjack/types'
import {
  calculateHandValue,
  doubleDownBlackjack,
  hitBlackjack,
  initBlackjack,
  startBlackjackRound,
  standBlackjack,
} from '@/games/blackjack/engine'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500 active:bg-red-700',     border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',   border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800',   border: 'border-zinc-400' },
]

interface BlackjackResult {
  outcome: BlackjackOutcome
  betAmount: number
  payout: number
  multiplier: number
}

interface BlackjackGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: BlackjackResult) => void
}

function isRedSuit(suit: string) {
  return suit === '♥' || suit === '♦'
}

function CardFace({ card, hidden = false }: { card: BlackjackCard; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="w-14 h-20 sm:w-18 sm:h-24 rounded-lg bg-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center flex-shrink-0">
        <div className="w-9 h-14 rounded border border-blue-600 bg-blue-800 opacity-60" />
      </div>
    )
  }
  return (
    <div className="w-14 h-20 sm:w-18 sm:h-24 rounded-lg bg-white shadow-lg flex flex-col items-start justify-between p-1.5 border border-gray-200 flex-shrink-0">
      <span className={`text-xs font-bold leading-none ${isRedSuit(card.suit) ? 'text-red-600' : 'text-gray-900'}`}>
        {card.rank}
      </span>
      <span className={`text-xl leading-none self-center ${isRedSuit(card.suit) ? 'text-red-600' : 'text-gray-900'}`}>
        {card.suit}
      </span>
      <span className={`text-xs font-bold leading-none self-end rotate-180 ${isRedSuit(card.suit) ? 'text-red-600' : 'text-gray-900'}`}>
        {card.rank}
      </span>
    </div>
  )
}

function CardBack() {
  return (
    <div className="w-14 h-20 sm:w-18 sm:h-24 rounded-lg bg-blue-900 border-2 border-blue-700 shadow-md flex items-center justify-center opacity-40 flex-shrink-0">
      <div className="w-9 h-14 rounded border border-blue-600 bg-blue-800" />
    </div>
  )
}

export function BlackjackGame({ mode, bankroll, onResolve }: BlackjackGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<BlackjackState>(initBlackjack())
  const [currentBet, setCurrentBet] = useState(0)

  const isBetting   = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled   = round.stage === 'settled'
  const canDouble   = round.canDouble && round.betAmount * 2 <= bankroll
  const canDeal     = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function settleRound(state: BlackjackState) {
    setRound(state)
    if (state.stage === 'settled' && state.outcome) {
      onResolve({
        outcome: state.outcome,
        betAmount: state.betAmount,
        payout: Math.round(state.betAmount * state.payoutMultiplier),
        multiplier: state.payoutMultiplier,
      })
    }
  }

  function handleDeal() {
    if (!canDeal) return
    settleRound(startBlackjackRound(currentBet))
    setCurrentBet(0)
  }

  function handleHit() {
    const next = hitBlackjack(round)
    if (next.stage === 'settled') { settleRound(next); return }
    setRound(next)
  }

  function handleStand() { settleRound(standBlackjack(round)) }
  function handleDouble() { if (canDouble) settleRound(doubleDownBlackjack(round)) }

  function handleNewHand() {
    setRound(initBlackjack())
    setCurrentBet(0)
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: 'linear-gradient(160deg, #0f4c2a 0%, #0a3d22 100%)' }}>
      {/* Status bar */}
      <div className="px-4 py-2 bg-black/20 flex items-center justify-between text-xs text-white/50 border-b border-white/5">
        <span className="font-semibold tracking-widest uppercase text-white/30">Blackjack</span>
        <span>{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 p-4 md:p-6 relative">

        {/* Dealer zone */}
        <div className="mb-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
            Dealer {!isBetting && round.dealerHand.length > 0 && !isInProgress && `— ${calculateHandValue(round.dealerHand)}`}
          </p>
          <div className="flex gap-2 flex-wrap min-h-[80px] sm:min-h-[96px] items-end">
            {round.dealerHand.length === 0 ? (
              <><CardBack /><CardBack /></>
            ) : (
              round.dealerHand.map((card, i) => (
                <CardFace key={`d-${i}`} card={card} hidden={i === 1 && isInProgress} />
              ))
            )}
          </div>
        </div>

        {/* Felt divider */}
        <div className="border-t border-white/10 my-4" />

        {/* Player zone */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
            You {round.playerHand.length > 0 && `— ${calculateHandValue(round.playerHand)}`}
          </p>
          <div className="flex gap-2 flex-wrap min-h-[80px] sm:min-h-[96px] items-end">
            {round.playerHand.length === 0 ? (
              <><CardBack /><CardBack /></>
            ) : (
              round.playerHand.map((card, i) => (
                <CardFace key={`p-${i}`} card={card} />
              ))
            )}
          </div>
        </div>

        {/* Result overlay */}
        {isSettled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65 rounded-none">
            <div className="text-center">
              <p className={`text-4xl sm:text-5xl font-black tracking-tight ${round.outcome === 'win' ? 'text-yellow-400' : round.outcome === 'push' ? 'text-white' : 'text-red-400'}`}>
                {round.outcome === 'win' ? 'WIN' : round.outcome === 'push' ? 'PUSH' : 'BUST'}
              </p>
              <p className="text-white/60 mt-1 text-sm">
                {round.outcome === 'win'
                  ? `+${formatChips(Math.round(round.betAmount * round.payoutMultiplier))}`
                  : round.outcome === 'push'
                  ? `${formatChips(round.betAmount)} returned`
                  : `-${formatChips(round.betAmount)}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Control zone ── */}
      <div className="border-t border-white/10 bg-black/30 p-4">

        {/* BETTING */}
        <div
          style={{ opacity: isBetting ? 1 : 0, pointerEvents: isBetting ? 'auto' : 'none', maxHeight: isBetting ? '160px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}
        >
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => addChip(chip.value)}
                disabled={chip.value > bankroll - currentBet}
                className={`w-14 h-14 rounded-full ${chip.bg} ${chip.border} border-2 text-white font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed`}
              >
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
              {currentBet > 0 && (
                <button onClick={() => setCurrentBet(0)} className="text-white/35 text-xs hover:text-white/70 ml-1 transition-colors">
                  ✕ Clear
                </button>
              )}
            </div>
            <button
              onClick={handleDeal}
              disabled={!canDeal}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/25 text-black font-bold rounded-lg transition-all text-sm shadow-lg"
            >
              Deal →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
        </div>

        {/* IN PROGRESS */}
        <div
          style={{ opacity: isInProgress ? 1 : 0, pointerEvents: isInProgress ? 'auto' : 'none', maxHeight: isInProgress ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-white/50 text-sm">
              Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span>
            </span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleHit}    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition-colors">Hit</button>
              <button onClick={handleStand}  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-sm transition-colors">Stand</button>
              <button onClick={handleDouble} disabled={!canDouble} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors">Double</button>
            </div>
          </div>
        </div>

        {/* SETTLED */}
        <div
          style={{ opacity: isSettled ? 1 : 0, pointerEvents: isSettled ? 'auto' : 'none', maxHeight: isSettled ? '80px' : '0', overflow: 'hidden', transition: 'opacity 250ms ease, max-height 300ms ease' }}
        >
          <div className="flex justify-center">
            <button onClick={handleNewHand} className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-sm shadow-lg transition-colors">
              New Hand →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
