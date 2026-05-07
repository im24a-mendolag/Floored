'use client'

import { useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatChips, formatMultiplier } from '@/utils/format'
import { advanceCrash, cashOutCrash, getCrashPayout, initCrash, startCrashRound } from '@/games/crash/engine'
import type { CrashState } from '@/games/crash/types'

interface CrashResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface CrashGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: CrashResult) => void
}

export function CrashGame({ mode, bankroll, onResolve }: CrashGameProps) {
  const [round, setRound] = useState<CrashState>(initCrash())

  function handlePlaceBet(amount: number) {
    setRound(startCrashRound(amount))
  }

  function handleAdvance() {
    const next = advanceCrash(round)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getCrashPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleCashOut() {
    const next = cashOutCrash(round)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getCrashPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initCrash())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crash</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Current multiplier</p>
              <p className="font-semibold">{formatMultiplier(round.currentMultiplier)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Potential payout</p>
              <p className="font-semibold">{formatChips(Math.round(round.betAmount * round.payoutMultiplier))}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Crash threshold</p>
              <p className="font-semibold">Hidden</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            <p className="font-semibold">Crash Rules</p>
            <p className="mt-2">Roll to grow the multiplier. Cash out before it crashes to win.</p>
            <p className="mt-2">If the multiplier reaches the hidden crash point, you lose your bet.</p>
          </div>
        </CardContent>
      </Card>

      {round.stage === 'betting' ? (
        <BetPanel mode={mode} freeplayBankroll={bankroll} onBet={handlePlaceBet} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Crash Round</CardTitle>
            <CardDescription>
              {round.outcome
                ? round.outcome === 'win'
                  ? `Cashed out at ${formatMultiplier(round.payoutMultiplier)}.`
                  : `Crashed at ${formatMultiplier(round.crashAt)}x.`
                : `Current multiplier is ${formatMultiplier(round.currentMultiplier)}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Outcome</p>
                <p className="font-semibold capitalize">{round.outcome ?? 'In progress'}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Bet</p>
                <p className="font-semibold">{formatChips(round.betAmount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Payout</p>
                <p className="font-semibold">{formatChips(getCrashPayout(round))}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleAdvance} disabled={round.stage === 'settled'}>
                {round.stage === 'settled' ? 'Round Ended' : 'Roll'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCashOut}
                disabled={round.stage !== 'inProgress'}
              >
                Cash Out
              </Button>
              <Button variant="secondary" onClick={handleNewRound}>
                New Round
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
