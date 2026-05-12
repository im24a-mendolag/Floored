'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WheelGame } from '@/components/wheel-game'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalWheelPage() {
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
    if (!runActive) router.replace('/survival')
  }, [runActive, router])

  if (!runActive) return null

  function handleResolve(result: {
    outcome: 'win' | 'loss'
    betAmount: number
    payout: number
    multiplier: number
  }) {
    const shouldAdvance = slotsUsed >= 2
    recordResult({
      id: `wheel-${Date.now()}`,
      game: 'wheel',
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
          <h1 className="text-3xl font-bold">Wheel</h1>
          <p className="text-muted-foreground mt-1">
            Pick a color and spin. 2× to 5× — higher colors are rarer.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-1">Floor {currentFloor}</div>
          <div className="mb-1">Min bet {formatChips(floorMinBet)}</div>
          <div>Slots used {slotsUsed}/3</div>
        </div>
      </div>

      <WheelGame mode="survival" bankroll={bankroll} onResolve={handleResolve} />
    </div>
  )
}
