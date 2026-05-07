'use client'

import { useMemo, useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { formatChips, formatMultiplier } from '@/utils/format'
import { getHiloPayout, initHilo, resolveHiloRound, startHiloRound } from '@/games/hilo/engine'
import type { HiloState } from '@/games/hilo/types'

interface HiloResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface HiloGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: HiloResult) => void
}

export function HiloGame({ mode, bankroll, onResolve }: HiloGameProps) {
  const [safeZone, setSafeZone] = useState(40)
  const [round, setRound] = useState<HiloState>(initHilo())

  const payout = useMemo(() => getHiloPayout(round), [round])
  const winChance = useMemo(() => round.safeZone, [round.safeZone])
  const dangerChance = useMemo(() => 100 - round.safeZone, [round.safeZone])

  function handlePlaceBet(amount: number) {
    setRound(startHiloRound(amount, safeZone))
  }

  function handleResolve() {
    const next = resolveHiloRound(round)
    setRound(next)

    if (next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout,
        multiplier: next.payoutMultiplier,
      })
    }
  }

  function handleNewRound() {
    setRound(initHilo())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hi-Lo</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Win chance</p>
              <p className="font-semibold">{winChance}%</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Danger chance</p>
              <p className="font-semibold">{dangerChance}%</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Payout</p>
              <p className="font-semibold">{formatMultiplier(round.payoutMultiplier)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Slider
              label="Safe zone"
              min={10}
              max={90}
              step={1}
              value={safeZone}
              valueLabel={`${safeZone}%`}
              onChange={(event) => setSafeZone(Number(event.currentTarget.value))}
            />
            <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <div className="relative h-6 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500"
                  style={{ width: `${safeZone}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span>Safe</span>
                <span>Danger</span>
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
              {round.rollResult !== null
                ? `Rolled ${round.rollResult}.`
                : 'Resolve to see if your safe zone holds.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Outcome</p>
                <p className="font-semibold capitalize">{round.outcome ?? 'Pending'}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Multiplier</p>
                <p className="font-semibold">{formatMultiplier(round.payoutMultiplier)}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Payout</p>
                <p className="font-semibold">{formatChips(payout)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleResolve} disabled={round.stage === 'settled'}>
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
