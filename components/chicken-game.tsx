'use client'

import { useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatChips, formatMultiplier } from '@/utils/format'
import {
  cashOutChicken,
  advanceChickenRound,
  getChickenPayout,
  initChicken,
  startChickenRound,
} from '@/games/chicken-road/engine'
import type { ChickenState } from '@/games/chicken-road/types'

interface ChickenResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface ChickenGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: ChickenResult) => void
}

export function ChickenGame({ mode, bankroll, onResolve }: ChickenGameProps) {
  const [round, setRound] = useState<ChickenState>(initChicken())

  function handlePlaceBet(amount: number) {
    setRound(startChickenRound(amount))
  }

  function handleAdvance() {
    const next = advanceChickenRound(round)
    setRound(next)

    if (next.stage === 'settled') {
      onResolve({
        outcome: next.outcome ?? 'loss',
        betAmount: next.betAmount,
        payout: getChickenPayout(next),
        multiplier: next.multiplier,
      })
    }
  }

  function handleCashOut() {
    const next = cashOutChicken(round)
    setRound(next)
    onResolve({
      outcome: 'win',
      betAmount: next.betAmount,
      payout: getChickenPayout(next),
      multiplier: next.multiplier,
    })
  }

  function handleNewRound() {
    setRound(initChicken())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chicken Road</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Current step</p>
              <p className="font-semibold">{round.step}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Payout if cashed</p>
              <p className="font-semibold">{formatChips(Math.round(round.betAmount * round.multiplier))}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Multiplier</p>
              <p className="font-semibold">{formatMultiplier(round.multiplier)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <p className="font-semibold">Step chance</p>
              <p className="mt-2">The road gets riskier each step.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {round.stage === 'betting' ? (
        <BetPanel mode={mode} freeplayBankroll={bankroll} onBet={handlePlaceBet} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Advance to the next step or cash out safely.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={handleAdvance} disabled={round.stage === 'settled'}>
              Advance
            </Button>
            <Button variant="outline" onClick={handleCashOut} disabled={round.stage === 'settled'}>
              Cash Out
            </Button>
            <Button variant="secondary" onClick={handleNewRound}>
              New Round
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
