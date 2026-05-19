'use client'

import { useState, useEffect, useRef } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { buildPendingResult } from '@/lib/game-result-labels'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { resolveGame } from '@/lib/survival/game-resolve'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { PerkHint } from '@/components/survival/perk-hint'
import type { BlackjackCard, BlackjackOutcome, BlackjackState } from '@/games/blackjack/types'
import {
  calculateHandValue,
  doubleDownBlackjack,
  hitBlackjack,
  initBlackjack,
  startBlackjackRound,
  standBlackjack,
} from '@/games/blackjack/engine'

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
  onResolve: GameResolveFn<BlackjackResult>
}

interface PendingResult {
  tone: 'win' | 'loss'
  label: string
  outcomeLabel: string
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
  const { lock, unlock } = useBetGuard()
  const minBet = mode === 'survival' ? floorMinBet : 1
  const { peekDealer } = useSurvivalPerks('blackjack')
  const showDealerHole = mode === 'survival' && peekDealer

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
      const resolved = resolveGame(onResolve, {
        outcome: state.outcome,
        betAmount: state.betAmount,
        payout,
        multiplier: state.payoutMultiplier,
      })
      const o = state.outcome!
      const resultKind =
        o === 'push' ? 'Push' : o === 'loss' ? 'Loss' : state.payoutMultiplier >= 2.5 ? 'Blackjack' : 'Win'
      const subtitle = `${formatChips(state.betAmount)} · ${resultKind} · ${formatMultiplier(state.payoutMultiplier)}`
      const built = buildPendingResult(
        { outcome: o, betAmount: state.betAmount, payout: resolved.payout },
        subtitle,
        { winLabel: 'Total winnings', lossLabel: 'No winnings' },
      )
      setTimeout(
        () =>
          setPendingResult({
            tone: built.tone === 'win' ? 'win' : 'loss',
            label: built.label,
            outcomeLabel: built.outcomeLabel,
            entry: built.entry,
          }),
        resultDelay,
      )
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
    if (!canDeal || !lock()) return
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
    onBet?.(round.betAmount)
    const finalState = doubleDownBlackjack(round)
    const playerBusted = calculateHandValue(finalState.playerHand) > 21

    // Keep stage 'inProgress' so the dealer hole card stays hidden while the
    // player's double card animates in; settling=true blocks player actions.
    setSettling(true)
    setRound(prev => ({
      ...prev,
      playerHand: finalState.playerHand,
      betAmount: finalState.betAmount,
      canDouble: false,
      message: 'Double down.',
    }))

    if (playerBusted) {
      const t = setTimeout(() => {
        setSettling(false)
        settleRound(finalState)
      }, 500)
      cancelDealerAnim.current = () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setSettling(false)
        animateDealerThenSettle(finalState)
      }, 400)
      cancelDealerAnim.current = () => clearTimeout(t)
    }
  }

  function handleNewHand() {
    unlock()
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
    unlock()
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    handleNewHand()
    survivalAfterNext(mode)
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
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4"
        entries={matchHistory}
        gameLabel="Blackjack"
      >

        <GameDockBackButton mode={mode} visible={isBetting} />
        {showDealerHole && isInProgress && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">Hole card visible</PerkHint>
        )}
        <GameActiveBetBadge betAmount={round.betAmount} visible={!isBetting && round.betAmount > 0} />

        <div className="flex w-full max-w-lg flex-1 min-h-0 flex-col items-center justify-center gap-2">
        {/* Dealer zone */}
        <div className="flex min-h-[calc(var(--card-h)+2rem)] flex-col items-center justify-end">
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
                  hidden={i === 1 && isInProgress && !showDealerHole}
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
        <div className="flex min-h-[calc(var(--card-h)+2rem)] flex-col items-center justify-start">
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

          <div className="min-h-10 flex w-full shrink-0 items-center justify-center">
            <p className="max-w-md px-2 text-center text-xs text-zinc-500">
              {isBetting
                ? 'Place chips and deal. Blackjack pays 3:2; push returns your bet.'
                : playerCanAct
                  ? 'Hit, stand, or double on two cards. Dealer hits on 16 and below.'
                  : '\u00A0'}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || playerCanAct}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={playerCanAct}
            minBet={minBet}
          />

          <div className="h-10 flex items-center justify-center">
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {round.stage === 'settled' && pendingResult && (
              <GameDockSettledRow
                outcomeLabel={pendingResult.outcomeLabel}
                label={pendingResult.label}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !(round.stage === 'settled' && pendingResult) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className="flex min-h-[2.75rem] w-full flex-col items-center justify-center gap-1">
            {isBetting && (
              <button
                type="button"
                onClick={handleDeal}
                disabled={!canDeal}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Deal →
              </button>
            )}
            {!isBetting && playerCanAct && (
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={handleHit} className="min-w-[5.25rem] px-6 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg text-base shadow-lg transition-colors">Hit</button>
                <button type="button" onClick={handleStand} className="min-w-[5.25rem] px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg text-base transition-colors">Stand</button>
                <button type="button" onClick={handleDouble} disabled={!canDouble} className="min-w-[5.25rem] px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-25 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-base transition-colors">Double</button>
              </div>
            )}
            {round.stage === 'settled' && pendingResult && (
              <button type="button" onClick={handleNextHand} className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">Next →</button>
            )}
          </div>

          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
