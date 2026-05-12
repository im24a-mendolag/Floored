'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { GameOutcomeToast, type GameOutcomeToastSnap } from '@/components/game-outcome-toast'
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

export function BlackjackGame({ mode, bankroll, onResolve }: BlackjackGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<BlackjackState>(initBlackjack())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [resultToastOpen, setResultToastOpen] = useState(false)
  const [resultToastSnap, setResultToastSnap] = useState<GameOutcomeToastSnap | null>(null)
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
      setMatchHistory((h) =>
        [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, at: new Date(), title, subtitle, tone }, ...h].slice(
          0,
          80,
        ),
      )
      const toastTone =
        o === 'win' ? 'win' : o === 'push' ? 'push' : 'loss'
      const toastTitle = o === 'win' ? 'WIN' : o === 'push' ? 'PUSH' : 'BUST'
      const toastSubtitle =
        o === 'win'
          ? `+${formatChips(payout)}`
          : o === 'push'
            ? `${formatChips(state.betAmount)} returned`
            : `-${formatChips(state.betAmount)}`
      setResultToastSnap({ title: toastTitle, subtitle: toastSubtitle, tone: toastTone })
      setTimeout(() => {
        setResultToastOpen(true)
        handleNewHand()
      }, resultDelay)
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

  const dismissResultToast = useCallback(() => {
    setResultToastOpen(false)
    setResultToastSnap(null)
  }, [])

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

      <GameOutcomeToast
        open={resultToastOpen && !!resultToastSnap}
        title={resultToastSnap?.title ?? ''}
        subtitle={resultToastSnap?.subtitle}
        tone={resultToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissResultToast}
      />

      {/* Control zone — shared max width so bet line and actions share one vertical axis */}
      <div className={GAME_CONTROL_DOCK_M}>
        {isBetting && (
          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col gap-3">
            <div className="flex flex-wrap justify-center gap-3">
              {CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => addChip(chip.value)}
                  disabled={chip.value > bankroll - currentBet}
                  className={`w-14 h-14 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentBet(bankroll)}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className="h-14 px-4 rounded-full bg-zinc-200 hover:bg-white border-2 border-zinc-100 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                All In
              </button>
            </div>
            <div className="flex items-center justify-center">
              <div className="grid w-full max-w-[280px] grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                <div className="min-w-0" aria-hidden />
                <div className="flex items-center justify-center gap-2.5 whitespace-nowrap">
                  <span className="text-zinc-500 text-base">Bet</span>
                  <span className="font-bold text-xl text-white tabular-nums">
                    {currentBet > 0 ? formatChips(currentBet) : '—'}
                  </span>
                </div>
                <div className="flex min-h-[2.25rem] items-center justify-end">
                  {currentBet > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentBet(0)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
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
            {minBet > 1 && <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>}
          </div>
        )}

        {!isBetting && (
          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col gap-3">
            <div className="flex items-center justify-center">
              <div className="grid w-full max-w-[280px] grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                <div className="min-w-0" aria-hidden />
                <div className="flex items-center justify-center gap-2.5 whitespace-nowrap">
                  <span className="text-zinc-500 text-base">Bet</span>
                  <span className="font-bold text-xl text-white tabular-nums">
                    {round.betAmount > 0 ? formatChips(round.betAmount) : '0'}
                  </span>
                </div>
                <div className="min-h-[2.25rem]" aria-hidden />
              </div>
            </div>
            {playerCanAct && (
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
          </div>
        )}
      </div>
    </div>
  )
}
