'use client'

import { useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { BlackjackCard, BlackjackOutcome, BlackjackState } from '@/games/blackjack/types'
import {
  calculateHandValue,
  doubleDownBlackjack,
  hitBlackjack,
  initBlackjack,
  startBlackjackRound,
  standBlackjack,
} from '@/games/blackjack/engine'

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

function cardLabel(card: BlackjackCard) {
  return `${card.rank}${card.suit}`
}

function cardColor(card: BlackjackCard) {
  return card.suit === '♥' || card.suit === '♦' ? 'text-red-500' : 'text-slate-900'
}

export function BlackjackGame({ mode, bankroll, onResolve }: BlackjackGameProps) {
  const [round, setRound] = useState<BlackjackState>(initBlackjack())

  const isSettled = round.stage === 'settled'
  const isInProgress = round.stage === 'inProgress'
  const canDouble = round.canDouble && round.betAmount * 2 <= bankroll

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

  function handlePlaceBet(amount: number) {
    settleRound(startBlackjackRound(amount))
  }

  function handleHit() {
    const next = hitBlackjack(round)
    if (next.stage === 'settled') {
      settleRound(next)
      return
    }
    setRound(next)
  }

  function handleStand() {
    settleRound(standBlackjack(round))
  }

  function handleDouble() {
    if (!canDouble) return
    settleRound(doubleDownBlackjack(round))
  }

  function handleNewHand() {
    setRound(initBlackjack())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Blackjack</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Current bet</p>
              <p className="font-semibold">{round.betAmount > 0 ? formatChips(round.betAmount) : '-'}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Expected return</p>
              <p className="font-semibold">{isSettled ? formatMultiplier(round.payoutMultiplier) : '-'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm uppercase text-muted-foreground">Dealer</p>
              <p className="font-semibold">
                {isSettled ? formatChips(calculateHandValue(round.dealerHand)) : 'Hidden card'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {round.dealerHand.map((card, index) => (
                <div
                  key={`${card.rank}${card.suit}-${index}`}
                  className={`w-20 h-28 rounded-xl border border-border bg-background p-3 shadow-sm flex items-center justify-center text-xl font-semibold ${
                    index === 1 && isInProgress ? 'bg-slate-200 text-transparent' : cardColor(card)
                  }`}
                >
                  {index === 1 && isInProgress ? '??' : cardLabel(card)}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {round.stage === 'betting' ? (
        <BetPanel mode={mode} freeplayBankroll={bankroll} onBet={handlePlaceBet} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Hand</CardTitle>
            <CardDescription>
              {calculateHandValue(round.playerHand)} value across {round.playerHand.length} card(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {round.playerHand.map((card, index) => (
                <div
                  key={`${card.rank}${card.suit}-${index}`}
                  className={`w-20 h-28 rounded-xl border border-border bg-background p-3 shadow-sm flex items-center justify-center text-xl font-semibold ${cardColor(card)}`}
                >
                  {cardLabel(card)}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {isInProgress ? (
                <>
                  <Button onClick={handleHit}>Hit</Button>
                  <Button variant="outline" onClick={handleStand}>Stand</Button>
                  <Button onClick={handleDouble} disabled={!canDouble} variant="secondary">
                    Double Down
                  </Button>
                </>
              ) : (
                <Button onClick={handleNewHand}>New Hand</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
