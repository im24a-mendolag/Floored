'use client'

import { useState, useEffect, useRef } from 'react'
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
  { value: 10,  label: '$10',  cls: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const CARD_BACK_PATTERN = 'repeating-linear-gradient(45deg, #27272a, #27272a 4px, #1f1f23 4px, #1f1f23 8px)'

const DEALER_CARD_DELAY = 700
const RESULT_DELAY = 600

const CARD_CSS: React.CSSProperties = {
  '--card-h': 'clamp(4rem, 13vh, 9rem)',
} as React.CSSProperties

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

const cardShell: React.CSSProperties = {
  width:      'calc(var(--card-h) * 5 / 7)',
  height:     'var(--card-h)',
  flexShrink: 0,
}

const cardInner: React.CSSProperties = {
  width:  '70%',
  height: '71%',
}

function CardFace({
  card,
  hidden = false,
  animDelay = 0,
}: {
  card: BlackjackCard
  hidden?: boolean
  animDelay?: number
}) {
  const prevHidden = useRef(hidden)
  const [animCls, setAnimCls] = useState<'card-deal-in' | 'card-reveal' | ''>('card-deal-in')

  useEffect(() => {
    if (prevHidden.current && !hidden) {
      setAnimCls('card-reveal')
      prevHidden.current = false
      const t = setTimeout(() => setAnimCls(''), 350)
      return () => clearTimeout(t)
    }
    prevHidden.current = hidden
  }, [hidden])

  const dealStyle = animCls === 'card-deal-in' ? { animationDelay: `${animDelay}ms` } : {}

  if (hidden) {
    return (
      <div
        className={`rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl flex items-center justify-center ${animCls}`}
        style={{ ...cardShell, ...dealStyle }}
      >
        <div className="rounded-lg border border-zinc-700" style={{ ...cardInner, background: CARD_BACK_PATTERN }} />
      </div>
    )
  }

  const color = isRedSuit(card.suit) ? 'text-red-600' : 'text-zinc-900'

  return (
    <div
      className={`rounded-xl bg-white shadow-2xl flex flex-col justify-between border border-zinc-200 select-none ${animCls}`}
      style={{ ...cardShell, ...dealStyle, padding: 'clamp(0.4rem, 0.7vh, 0.85rem)' }}
    >
      <div className={`flex flex-col items-start leading-none ${color}`}>
        <span className="font-black leading-none" style={{ fontSize: 'clamp(0.75rem, 1.9vh, 1.5rem)' }}>{card.rank}</span>
        <span className="leading-none"            style={{ fontSize: 'clamp(0.65rem, 1.6vh, 1.1rem)' }}>{card.suit}</span>
      </div>
      <span
        className={`leading-none self-center ${color}`}
        style={{ fontSize: 'clamp(1.75rem, 5vh, 3.75rem)' }}
      >
        {card.suit}
      </span>
      <div className={`flex flex-col items-start rotate-180 leading-none ${color}`}>
        <span className="font-black leading-none" style={{ fontSize: 'clamp(0.75rem, 1.9vh, 1.5rem)' }}>{card.rank}</span>
        <span className="leading-none"            style={{ fontSize: 'clamp(0.65rem, 1.6vh, 1.1rem)' }}>{card.suit}</span>
      </div>
    </div>
  )
}

function CardBack() {
  return (
    <div
      className="rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl flex items-center justify-center opacity-40"
      style={cardShell}
    >
      <div className="rounded-lg border border-zinc-700" style={{ ...cardInner, background: CARD_BACK_PATTERN }} />
    </div>
  )
}

export function BlackjackGame({ mode, bankroll, onResolve }: BlackjackGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<BlackjackState>(initBlackjack())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [dealerDisplayHand, setDealerDisplayHand] = useState<BlackjackCard[] | null>(null)
  const cancelDealerAnim = useRef<(() => void) | null>(null)

  const displayedDealerHand = dealerDisplayHand ?? round.dealerHand

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const canDouble    = round.canDouble && round.betAmount * 2 <= bankroll
  const canDeal      = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function settleRound(state: BlackjackState, resultDelay = RESULT_DELAY) {
    setRound(state)
    if (state.stage === 'settled' && state.outcome) {
      onResolve({
        outcome: state.outcome,
        betAmount: state.betAmount,
        payout: Math.round(state.betAmount * state.payoutMultiplier),
        multiplier: state.payoutMultiplier,
      })
      setTimeout(() => setShowResult(true), resultDelay)
    }
  }

  function animateDealerThenSettle(finalState: BlackjackState) {
    const fullHand = finalState.dealerHand
    setRound(prev => ({ ...prev, stage: 'settled' as BlackjackState['stage'], outcome: null }))
    setDealerDisplayHand(fullHand.slice(0, 2))

    const ids: ReturnType<typeof setTimeout>[] = []
    let delay = 0

    for (let i = 2; i < fullHand.length; i++) {
      const count = i + 1
      delay += DEALER_CARD_DELAY
      ids.push(setTimeout(() => setDealerDisplayHand(fullHand.slice(0, count)), delay))
    }

    delay += DEALER_CARD_DELAY
    ids.push(setTimeout(() => {
      setDealerDisplayHand(null)
      settleRound(finalState, 200)
    }, delay))

    cancelDealerAnim.current = () => ids.forEach(clearTimeout)
  }

  function handleDeal() {
    if (!canDeal) return
    setLastBet(currentBet)
    settleRound(startBlackjackRound(currentBet))
    setCurrentBet(0)
  }

  function handleHit() {
    const next = hitBlackjack(round)
    if (next.stage === 'settled') { settleRound(next); return }
    setRound(next)
  }

  function handleStand() { animateDealerThenSettle(standBlackjack(round)) }

  function handleDouble() {
    if (!canDouble) return
    const finalState = doubleDownBlackjack(round)
    const playerBusted = calculateHandValue(finalState.playerHand) > 21

    setRound(prev => ({
      ...prev,
      playerHand: finalState.playerHand,
      betAmount: finalState.betAmount,
      canDouble: false,
      message: 'Double down.',
      stage: 'settled' as BlackjackState['stage'],
      outcome: null,
    }))

    if (playerBusted) {
      const t = setTimeout(() => settleRound(finalState), 500)
      cancelDealerAnim.current = () => clearTimeout(t)
    } else {
      const t = setTimeout(() => animateDealerThenSettle(finalState), 400)
      cancelDealerAnim.current = () => clearTimeout(t)
    }
  }

  function handleNewHand() {
    cancelDealerAnim.current?.()
    cancelDealerAnim.current = null
    setDealerDisplayHand(null)
    setRound(initBlackjack())
    setCurrentBet(Math.min(lastBet, bankroll))
    setShowResult(false)
  }

  const outcomeLabel =
    round.outcome === 'win'  ? 'WIN'  :
    round.outcome === 'push' ? 'PUSH' : 'BUST'

  const outcomeColor =
    round.outcome === 'win'  ? 'text-white' :
    round.outcome === 'push' ? 'text-zinc-400' : 'text-zinc-500'

  const outcomeAmount =
    round.outcome === 'win'
      ? `+${formatChips(Math.round(round.betAmount * round.payoutMultiplier))}`
      : round.outcome === 'push'
      ? `${formatChips(round.betAmount)} returned`
      : `-${formatChips(round.betAmount)}`

  return (
    <div
      className="flex-1 min-h-0 rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-zinc-950 border border-zinc-800"
      style={CARD_CSS}
    >
      {/* Status bar */}
      <div className="shrink-0 px-5 py-2 bg-black flex items-center justify-between border-b border-zinc-800">
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Blackjack</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      {/* Game board */}
      <div className="flex-1 min-h-0 px-4 md:px-8 py-2 relative flex flex-col">

        {/* Dealer zone */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-sm uppercase tracking-widest text-zinc-600 mb-2">
            Dealer
            {!isBetting && displayedDealerHand.length > 0 && !isInProgress && (
              <span className="ml-2 text-zinc-300 font-bold">
                {calculateHandValue(displayedDealerHand)}
              </span>
            )}
          </p>
          <div className="flex gap-3 flex-wrap items-end justify-center">
            {displayedDealerHand.length === 0 ? (
              <><CardBack /><CardBack /></>
            ) : (
              displayedDealerHand.map((card, i) => (
                <CardFace
                  key={`d-${i}`}
                  card={card}
                  hidden={i === 1 && isInProgress}
                  animDelay={i * 100}
                />
              ))
            )}
          </div>
        </div>

        {/* Divider with inline rules */}
        <div className="shrink-0 my-0.5">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 pb-1 text-xs text-zinc-600">
            <span>Blackjack 3:2</span>
            <span className="text-zinc-800">·</span>
            <span>Win 1:1</span>
            <span className="text-zinc-800">·</span>
            <span>Push returned</span>
          </div>
          <div className="border-t border-zinc-800" />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 pt-1 text-xs text-zinc-600">
            <span>Dealer hits ≤ 16</span>
            <span className="text-zinc-800">·</span>
            <span>Double on 2 cards</span>
            <span className="text-zinc-800">·</span>
            <span>No split</span>
            <span className="text-zinc-800">·</span>
            <span>No surrender</span>
          </div>
        </div>

        {/* Player zone */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-sm uppercase tracking-widest text-zinc-600 mb-2">
            You
            {round.playerHand.length > 0 && (
              <span className="ml-2 text-zinc-300 font-bold">
                {calculateHandValue(round.playerHand)}
              </span>
            )}
          </p>
          <div className="flex gap-3 flex-wrap items-end justify-center">
            {round.playerHand.length === 0 ? (
              <><CardBack /><CardBack /></>
            ) : (
              round.playerHand.map((card, i) => (
                <CardFace key={`p-${i}`} card={card} animDelay={i * 100} />
              ))
            )}
          </div>
        </div>

        {/* Result overlay */}
        {showResult && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <p className={`text-7xl sm:text-8xl font-black tracking-tight ${outcomeColor}`}>
                {outcomeLabel}
              </p>
              <p className="text-zinc-400 mt-3 text-base font-medium">{outcomeAmount}</p>
            </div>
          </div>
        )}
      </div>

      {/* Control zone */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 py-3">

        {/* BETTING */}
        <div
          style={{
            opacity: isBetting ? 1 : 0,
            pointerEvents: isBetting ? 'auto' : 'none',
            maxHeight: isBetting ? '190px' : '0',
            overflow: 'hidden',
            transition: 'opacity 250ms ease, max-height 300ms ease',
          }}
        >
          <div className="flex gap-3 flex-wrap justify-center mb-3">
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => addChip(chip.value)}
                disabled={chip.value > bankroll - currentBet}
                className={`w-14 h-14 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
              >
                {chip.label}
              </button>
            ))}
            <button
              onClick={() => setCurrentBet(bankroll)}
              disabled={currentBet >= bankroll || bankroll <= 0}
              className="h-14 px-4 rounded-full bg-zinc-200 hover:bg-white border-2 border-zinc-100 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              All In
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-500 text-base">Bet</span>
              <span className="font-bold text-xl text-white">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
              {currentBet > 0 && (
                <button
                  onClick={() => setCurrentBet(0)}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ml-1"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={handleDeal}
              disabled={!canDeal}
              className="px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
            >
              Deal →
            </button>
          </div>
          {minBet > 1 && <p className="text-zinc-600 text-sm mt-2.5">Min bet: {formatChips(minBet)}</p>}
        </div>

        {/* IN PROGRESS */}
        <div
          style={{
            opacity: isInProgress ? 1 : 0,
            pointerEvents: isInProgress ? 'auto' : 'none',
            maxHeight: isInProgress ? '100px' : '0',
            overflow: 'hidden',
            transition: 'opacity 250ms ease, max-height 300ms ease',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-zinc-500 text-base">
              Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span>
            </span>
            <div className="flex gap-2.5">
              <button onClick={handleHit}    className="px-6 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg text-base transition-colors shadow">Hit</button>
              <button onClick={handleStand}  className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg text-base transition-colors">Stand</button>
              <button onClick={handleDouble} disabled={!canDouble} className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-25 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-base transition-colors">Double</button>
            </div>
          </div>
        </div>

        {/* SETTLED */}
        <div
          style={{
            opacity: showResult ? 1 : 0,
            pointerEvents: showResult ? 'auto' : 'none',
            maxHeight: showResult ? '100px' : '0',
            overflow: 'hidden',
            transition: 'opacity 250ms ease, max-height 300ms ease',
          }}
        >
          <div className="flex justify-center">
            <button onClick={handleNewHand} className="px-10 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg text-base shadow-lg transition-colors">
              New Hand →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
