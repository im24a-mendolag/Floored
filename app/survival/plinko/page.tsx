'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlinkoGame } from '@/components/plinko-game'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalPlinkoPage() {
  const router = useRouter()
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const recordResult = useSurvivalStore((s) => s.recordResult)
  const runActive = useSurvivalStore((s) => s.runActive)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)

  useEffect(() => {
    if (!runActive) {
      router.replace('/survival')
    }
  }, [runActive, router])

  function handleResolve(result: { outcome: 'win' | 'loss' | 'push'; betAmount: number; payout: number; multiplier: number }) {
    recordResult({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      game: 'plinko',
      floor: currentFloor,
      betAmount: result.betAmount,
      payout: result.payout,
      outcome: result.outcome === 'push' ? 'push' : result.payout > result.betAmount ? 'win' : 'loss',
      multiplier: result.multiplier,
      playedAt: new Date(),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plinko</h1>
          <p className="text-muted-foreground mt-1">Survival mode Plinko. Drop the puck and chase the highest slot.</p>
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-1">Bankroll {formatChips(bankroll)}</div>
          <div className="flex gap-2">
            <Link href="/survival" className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              Back to Survival
            </Link>
          </div>
        </div>
      </div>

      {bankroll > 0 ? (
        <PlinkoGame mode="survival" bankroll={bankroll} onResolve={handleResolve} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Your survival bankroll is empty. Return to the lobby to end the run or choose another game.
        </div>
      )}
    </div>
  )
}
