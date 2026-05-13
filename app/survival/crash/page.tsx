'use client'

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
  const deductBet = useSurvivalStore((s) => s.deductBet)
  const recordResultPayout = useSurvivalStore((s) => s.recordResultPayout)
  const advanceFloor = useSurvivalStore((s) => s.advanceFloor)
  const endRun = useSurvivalStore((s) => s.endRun)

  useEffect(() => {
    if (!runActive) router.replace('/survival')
  }, [runActive, router])

  if (!runActive) return null

  function handleBet(amount: number) {
    deductBet(amount)
  }

  function handleResolve(result: { outcome: 'win' | 'loss'; betAmount: number; payout: number; multiplier: number }) {
    const shouldAdvance = slotsUsed >= 2
    recordResultPayout({
      id: `crash-${Date.now()}`,
      game: 'crash',
      floor: currentFloor,
      betAmount: result.betAmount,
      payout: result.payout,
      outcome: result.outcome,
      multiplier: result.multiplier,
      playedAt: new Date(),
    })
    if (shouldAdvance) advanceFloor()
    if (useSurvivalStore.getState().bankroll <= 0) endRun()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0 flex justify-end">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Floor {currentFloor}</span>
          <span className="text-zinc-700">·</span>
          <span>Min {formatChips(floorMinBet)}</span>
          <span className="text-zinc-700">·</span>
          <span>{slotsUsed}/3 slots</span>
        </div>
      </div>
      <CrashGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
