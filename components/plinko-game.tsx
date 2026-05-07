'use client'

import { useMemo, useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatChips } from '@/utils/format'
import { getSlotMultipliers, getPlinkoPayout, initPlinko, resolvePlinkoRound, startPlinkoRound } from '@/games/plinko/engine'
import type { PlinkoState } from '@/games/plinko/types'

interface PlinkoResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface PlinkoGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: PlinkoResult) => void
}

export function PlinkoGame({ mode, bankroll, onResolve }: PlinkoGameProps) {
  const [round, setRound] = useState<PlinkoState>(initPlinko())
  const slots = useMemo(() => getSlotMultipliers(), [])

  function handlePlaceBet(amount: number) {
    setRound(startPlinkoRound(amount))
  }

  function handleDrop() {
    const next = resolvePlinkoRound(round)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getPlinkoPayout(next),
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initPlinko())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plinko</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
                <p className="font-semibold">{formatChips(bankroll)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase text-muted-foreground">Bet</p>
                <p className="font-semibold">{round.betAmount ? formatChips(round.betAmount) : '-'}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase text-muted-foreground">Result slot</p>
                <p className="font-semibold">{round.finalSlot ?? '-'}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase text-muted-foreground">Payout</p>
                <p className="font-semibold">
                  {round.stage === 'settled' ? formatChips(getPlinkoPayout(round)) : '-'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <p className="font-semibold">Slot Multipliers</p>
              <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs">
                {slots.map((multiplier, index) => (
                  <div key={index} className="rounded-lg border border-border bg-card px-2 py-3">
                    <p className="font-semibold">{index}</p>
                    <p>{multiplier === 0 ? 'Lose' : `${multiplier}x`}</p>
                  </div>
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
            <CardTitle>Drop</CardTitle>
            <CardDescription>
              {round.stage === 'inProgress'
                ? 'Drop the puck to resolve your round.'
                : `Final slot ${round.finalSlot} landed with ${round.payoutMultiplier}x.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Outcome</p>
                <p className="font-semibold capitalize">{round.outcome ?? 'Pending'}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Path length</p>
                <p className="font-semibold">{round.path.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Multiplier</p>
                <p className="font-semibold">{round.payoutMultiplier}x</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-8 gap-2 text-center text-xs">
                {round.path.map((pos, index) => (
                  <div key={index} className="rounded-lg border border-border bg-card px-2 py-2">
                    {pos}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDrop} disabled={round.stage !== 'inProgress'}>
                  Drop
                </Button>
                <Button variant="secondary" onClick={handleNewRound}>
                  New Round
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
