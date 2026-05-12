'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SlotsGame } from '@/components/slots-game'
import { useSurvivalStore } from '@/store/survival-store'

export default function SurvivalSlotsPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const slotsUsed = useSurvivalStore((s) => s.slotsUsed)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const recordResult = useSurvivalStore((s) => s.recordResult)
  const advanceFloor = useSurvivalStore((s) => s.advanceFloor)
  const endRun = useSurvivalStore((s) => s.endRun)

  useEffect(() => {
    if (!runActive) router.replace('/survival')
  }, [runActive, router])

  if (!runActive) return null

  function handleResolve(result: { outcome: 'win' | 'loss'; betAmount: number; payout: number; multiplier: number }) {
    const shouldAdvance = slotsUsed >= 2

    recordResult({
      id: `slots-${Date.now()}`,
      game: 'slots',
      floor: currentFloor,
      betAmount: result.betAmount,
      payout: result.payout,
      outcome: result.outcome,
      multiplier: result.multiplier,
      playedAt: new Date(),
    })

    if (shouldAdvance) advanceFloor()

    const nextBankroll = bankroll - result.betAmount + result.payout
    if (nextBankroll <= 0) endRun()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Slots</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Each spin fills the jackpot meter. Hit 100% for a guaranteed 100× spin.
        </p>
      </div>

      {bankroll > 0 ? (
        <SlotsGame mode="survival" bankroll={bankroll} onResolve={handleResolve} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Your bankroll is empty. Return to survival lobby.
        </div>
      )}
    </div>
  )
}
