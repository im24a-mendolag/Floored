'use client'

import { useMemo, useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { formatChips, formatMultiplier } from '@/utils/format'
import {
  getPayoutMultiplier,
  getWinProbability,
  getPushProbability,
  initDice,
  resolveDiceRound,
  startDiceRound,
  getDiceResultPayout,
} from '@/games/dice/engine'
import type { DiceSide } from '@/games/dice/types'

interface DiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface DiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: DiceResult) => void
}

const THRESHOLDS = Array.from({ length: 9 }, (_, index) => 3 + index)
const SIDES: DiceSide[] = ['under', 'over']

export function DiceGame({ mode, bankroll, onResolve }: DiceGameProps) {
  const [threshold, setThreshold] = useState(7)
  const [side, setSide] = useState<DiceSide>('under')
  const [round, setRound] = useState(initDice())

  const chance = useMemo(() => getWinProbability(threshold, side), [threshold, side])
  const pushChance = useMemo(() => getPushProbability(threshold), [threshold])
  const multiplier = useMemo(() => getPayoutMultiplier(threshold, side), [threshold, side])

  function handlePlaceBet(amount: number) {
    setRound(startDiceRound(amount, threshold, side))
  }

  function handleResolve() {
    const next = resolveDiceRound(round)
    setRound(next)

    if (next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getDiceResultPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initDice())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dice Over/Under</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Chance to win</p>
              <p className="font-semibold">{(chance * 100).toFixed(1)}%</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Push chance</p>
              <p className="font-semibold">{(pushChance * 100).toFixed(1)}%</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Payout</p>
              <p className="font-semibold">{formatMultiplier(multiplier)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Slider
              label="Threshold"
              min={3}
              max={11}
              step={1}
              value={threshold}
              valueLabel={`${threshold}`}
              onChange={(event) => setThreshold(Number(event.currentTarget.value))}
            />

            <div>
              <p className="text-sm uppercase text-muted-foreground">Side</p>
              <div className="mt-2 flex gap-2">
                {SIDES.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={side === option ? 'default' : 'outline'}
                    onClick={() => setSide(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {round.stage === 'betting' ? (
        <BetPanel mode={mode} freeplayBankroll={bankroll} onBet={handlePlaceBet} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              {round.rollResult !== null ? `Rolled a ${round.rollResult}.` : 'Resolve the roll to see the outcome.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Outcome</p>
                <p className="font-semibold capitalize">{round.outcome}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Multiplier</p>
                <p className="font-semibold">{formatMultiplier(round.payoutMultiplier)}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Payout</p>
                <p className="font-semibold">
                  {round.outcome === 'win'
                    ? formatChips(getDiceResultPayout(round))
                    : round.outcome === 'push'
                    ? formatChips(round.betAmount)
                    : formatChips(0)}
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleResolve} disabled={round.stage === 'settled'}>
                {round.stage === 'settled' ? 'Resolved' : 'Roll Dice'}
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
