'use client'

import { useState, useEffect, useRef } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import type { BlackjackCard, BlackjackOutcome, BlackjackState } from '@/games/blackjack/types'
import { GAMBLING_QUOTES, pickQuote } from '@/lib/gambling-quotes'
import {
  calculateHandValue,
  doubleDownBlackjack,
  hitBlackjack,
  initBlackjack,
  startBlackjackRound,
  standBlackjack,
} from '@/games/blackjack/engine'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
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
  onBet?: (amount: number) => void
  onResolve: (result: BlackjackResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
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
        className={`rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl flex items-center justify-center overflow-hidden ${animCls}`}
        style={{ ...cardShell, ...dealStyle }}
      >
        <div className="rounded-lg border border-zinc-700" style={{ ...cardInner, background: CARD_BACK_PATTERN }} />
      </div>
    )
  }

  const color = isRedSuit(card.suit) ? 'text-red-600' : 'text-zinc-900'

  return (
    <div
      className={`rounded-xl bg-white shadow-2xl flex flex-col justify-between border border-zinc-200 select-none overflow-hidden ${animCls}`}
      style={{ ...cardShell, ...dealStyle, padding: 'calc(var(--card-h) * 0.07)' }}
    >
      <div className={`flex flex-col items-start leading-none ${color}`}>
        <span className="font-black leading-none" style={{ fontSize: 'calc(var(--card-h) * 0.13)' }}>{card.rank}</span>
        <span className="leading-none"            style={{ fontSize: 'calc(var(--card-h) * 0.11)' }}>{card.suit}</span>
      </div>
      <span
        className={`leading-none self-center ${color}`}
        style={{ fontSize: 'calc(var(--card-h) * 0.35)' }}
      >
        {card.suit}
      </span>
      <div className={`flex flex-col items-start rotate-180 leading-none ${color}`}>
        <span className="font-black leading-none" style={{ fontSize: 'calc(var(--card-h) * 0.13)' }}>{card.rank}</span>
        <span className="leading-none"            style={{ fontSize: 'calc(var(--card-h) * 0.11)' }}>{card.suit}</span>
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

export function BlackjackGame({ mode, bankroll, onBet, onResolve }: BlackjackGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<BlackjackState>(initBlackjack())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [dealerDisplayHand, setDealerDisplayHand] = useState<BlackjackCard[] | null>(null)
  const [settling, setSettling] = useState(false)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const cancelDealerAnim = useRef<(() => void) | null>(null)

  const displayedDealerHand = dealerDisplayHand ?? round.dealerHand

  // Delayed hand lengths — scores only appear after deal animation completes (~300ms)
  const [playerVisibleLen, setPlayerVisibleLen] = useState(0)
  const [dealerVisibleLen, setDealerVisibleLen] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setPlayerVisibleLen(round.playerHand.length), 300)
    return () => clearTimeout(t)
  }, [round.playerHand.length])

  useEffect(() => {
    const len = displayedDealerHand.length
    const t = setTimeout(() => setDealerVisibleLen(len), 300)
    return () => clearTimeout(t)
  }, [displayedDealerHand.length])

  const isBetting     = round.stage === 'betting'
  const isInProgress  = round.stage === 'inProgress'
  const playerCanAct  = isInProgress && !settling
  const canDouble     = round.canDouble && round.betAmount * 2 <= bankroll
  const canDeal      = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function settleRound(state: BlackjackState, resultDelay = RESULT_DELAY) {
    setRound(state)
    if (state.stage === 'settled' && state.outcome) {
      const payout = Math.round(state.betAmount * state.payoutMultiplier)
      onResolve({
        outcome: state.outcome,
        betAmount: state.betAmount,
        payout,
        multiplier: state.payoutMultiplier,
      })
      const o = state.outcome
      const tone: MatchHistoryTone = o === 'win' ? 'win' : o === 'push' ? 'push' : 'loss'
      const title =
        o === 'win' ? `+${formatChips(payout)}` : o === 'push' ? `Push ${formatChips(payout)}` : `−${formatChips(state.betAmount)}`
      const subtitle = `${formatChips(state.betAmount)} bet · You ${calculateHandValue(state.playerHand)} vs dealer ${calculateHandValue(state.dealerHand)}`
      setTimeout(() => setPendingResult({
        tone,
        label: title,
        entry: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, at: new Date(), title, subtitle, tone },
      }), resultDelay)
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
    onBet?.(currentBet)
    setQuoteIdx((prev) => pickQuote(prev))
    setLastBet(currentBet)
    settleRound(startBlackjackRound(currentBet))
    setCurrentBet(0)
  }

  function handleHit() {
    const next = hitBlackjack(round)
    if (next.stage === 'settled') {
      // Show the busting card first; keep round.stage='inProgress' so the
      // dealer hole card stays hidden until the deal animation finishes.
      setSettling(true)
      setRound(prev => ({
        ...prev,
        playerHand: next.playerHand,
        deck: next.deck,
        canDouble: false,
        message: next.message,
      }))
      const t = setTimeout(() => {
        setSettling(false)
        settleRound(next)
      }, 600)
      cancelDealerAnim.current = () => clearTimeout(t)
      return
    }
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
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
    setSettling(false)
    setPlayerVisibleLen(0)
    setDealerVisibleLen(0)
  }

  function handleNextHand() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    handleNewHand()
  }

  return (
    <div className={GAME_CARD_SHELL} style={CARD_CSS}>
      {/* Status bar */}
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Blackjack</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col px-4 md:px-8 py-2"
        entries={matchHistory}
        gameLabel="Blackjack"
      >

        {/* Active bet badge — shown in top-left while hand is in progress */}
        {!isBetting && round.betAmount > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(round.betAmount)}</p>
          </div>
        )}

        {/* Dealer zone */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-sm uppercase tracking-widest text-zinc-600 mb-2">
            Dealer
            {!isBetting && !isInProgress && dealerVisibleLen > 0 && (
              <span className="ml-2 text-zinc-300 font-bold">
                {calculateHandValue(displayedDealerHand.slice(0, dealerVisibleLen))}
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
            {playerVisibleLen > 0 && (
              <span className="ml-2 text-zinc-300 font-bold">
                {calculateHandValue(round.playerHand.slice(0, playerVisibleLen))}
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

      </GameFieldWithHistory>

      {/* Control zone */}
      <div className={GAME_CONTROL_DOCK_M}>
        {/* Top: variable content (chips during betting, result after settled) */}
        <div className="flex-1 flex flex-col items-center justify-start pt-3 gap-3 min-h-0">
          {isBetting && (
            <div className="w-full max-w-sm flex flex-col gap-3">
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
          {!isBetting && playerCanAct && (
            <p className="max-w-xs text-center text-sm italic text-zinc-600">
              "{GAMBLING_QUOTES[quoteIdx]}"
            </p>
          )}
          {round.stage === 'settled' && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? 'Win' : pendingResult.tone === 'push' ? 'Push' : 'Bust'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${
                pendingResult.tone === 'win' ? 'text-green-400' :
                pendingResult.tone === 'push' ? 'text-zinc-300' : 'text-red-400'
              }`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Bottom: action button — always anchored at the same position */}
        <div className="mx-auto w-full max-w-sm flex flex-col gap-2">
          {isBetting && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleDeal}
                disabled={!canDeal}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Deal →
              </button>
            </div>
          )}
          {!isBetting && playerCanAct && (
            <div className="flex flex-wrap justify-center gap-2.5">
              <button type="button" onClick={handleHit} className="min-w-[5.25rem] px-6 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg text-base transition-colors shadow">
                Hit
              </button>
              <button type="button" onClick={handleStand} className="min-w-[5.25rem] px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg text-base transition-colors">
                Stand
              </button>
              <button
                type="button"
                onClick={handleDouble}
                disabled={!canDouble}
                className="min-w-[5.25rem] px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-25 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-base transition-colors"
              >
                Double
              </button>
            </div>
          )}
          {round.stage === 'settled' && pendingResult && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleNextHand}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Next Hand →
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
