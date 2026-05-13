'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlinkoGame } from '@/components/plinko-game'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalPlinkoPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const slotsUsed = useSurvivalStore((s) => s.slotsUsed)
  const deductBet = useSurvivalStore((s) => s.deductBet)
  const recordResultPayout = useSurvivalStore((s) => s.recordResultPayout)

  useEffect(() => {
    if (!runActive) {
      router.replace('/survival')
    }
  }, [runActive, router])

  if (!runActive) return null

  function handleBet(amount: number) {
    deductBet(amount)
  }

  function handleResolve(result: { outcome: 'win' | 'loss' | 'push'; betAmount: number; payout: number; multiplier: number }) {
    recordResultPayout({
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

      <PlinkoGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
