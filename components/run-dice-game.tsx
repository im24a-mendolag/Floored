'use client'

import { useMemo, useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatChips, formatMultiplier } from '@/utils/format'
import {
  getRunDicePayout,
  initRunDice,
  rollRunDice,
  startRunDiceRound,
} from '@/games/run-dice/engine'
import type { RunDiceConfig, RunDiceState } from '@/games/run-dice/types'

interface RunDiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface RunDiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  config?: RunDiceConfig
  onResolve: (result: RunDiceResult) => void
}

export function RunDiceGame({ mode, bankroll, config, onResolve }: RunDiceGameProps) {
  const [round, setRound] = useState<RunDiceState>(initRunDice(config))

  const winChance = useMemo(() => {
    const total = round.config.win.reduce((sum, value) => sum + ({2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1}[value] ?? 0), 0)
    return total / 36
  }, [round.config.win])

  function handlePlaceBet(amount: number) {
    setRound(startRunDiceRound(amount, round.config))
  }

  function handleRoll() {
    const next = rollRunDice(round)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getRunDicePayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initRunDice(config))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run Dice</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Win chance</p>
              <p className="font-semibold">{(winChance * 100).toFixed(1)}%</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Payout</p>
              <p className="font-semibold">{formatMultiplier(round.payoutMultiplier)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Neutral rolls</p>
              <p className="font-semibold">{round.rollCount}/3</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <p className="font-semibold">Run Dice Config</p>
              <p className="mt-2">Win: {round.config.win.join(', ')}</p>
              <p>Loss: {round.config.loss.join(', ')}</p>
              <p>Neutral: {round.config.neutral.join(', ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {round.stage === 'betting' ? (
        <BetPanel mode={mode} freeplayBankroll={bankroll} onBet={handlePlaceBet} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Roll Result</CardTitle>
            <CardDescription>
              {round.rollResult !== null ? `Rolled a ${round.rollResult}.` : 'Press roll to begin.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Outcome</p>
                <p className="font-semibold capitalize">{round.outcome ?? 'Pending'}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Payout</p>
                <p className="font-semibold">{formatChips(getRunDicePayout(round))}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Rolls used</p>
                <p className="font-semibold">{round.rollCount}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleRoll} disabled={round.stage === 'settled'}>
                {round.stage === 'settled' ? 'Resolved' : 'Roll'}
              </Button>
              <Button variant="outline" onClick={handleNewRound}>
                New Round
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
