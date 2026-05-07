'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CrashGame } from '@/components/crash-game'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalCrashPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const slotsUsed = useSurvivalStore((s) => s.slotsUsed)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const recordResult = useSurvivalStore((s) => s.recordResult)
  const advanceFloor = useSurvivalStore((s) => s.advanceFloor)
  const endRun = useSurvivalStore((s) => s.endRun)

  useEffect(() => {
    if (!runActive) {
      router.replace('/survival')
    }
  }, [runActive, router])

  if (!runActive) return null

  function handleResolve(result: { outcome: 'win' | 'loss'; betAmount: number; payout: number; multiplier: number }) {
    const shouldAdvance = slotsUsed >= 2

    recordResult({
      id: `crash-${Date.now()}`,
      game: 'crash',
      floor: currentFloor,
      betAmount: result.betAmount,
      payout: result.payout,
      outcome: result.outcome,
      multiplier: result.multiplier,
      playedAt: new Date(),
    })

    if (shouldAdvance) {
      advanceFloor()
    }

    const nextBankroll = bankroll - result.betAmount + result.payout
    if (nextBankroll <= 0) {
      endRun()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Crash</h1>
          <p className="text-muted-foreground mt-1">Survival mode Crash game. Cash out before the crash to stay alive.</p>
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-1">Floor {currentFloor}</div>
          <div className="mb-1">Min bet {formatChips(floorMinBet)}</div>
          <div>Slots used {slotsUsed}/3</div>
        </div>
      </div>

      {bankroll > 0 ? (
        <CrashGame mode="survival" bankroll={bankroll} onResolve={handleResolve} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Your survival bankroll is empty. Return to the lobby to end the run or choose another game.
        </div>
      )}
    </div>
  )
}
