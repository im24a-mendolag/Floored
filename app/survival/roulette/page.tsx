'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RouletteGame } from '@/components/roulette-game'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalRoulettePage() {
  const router        = useRouter()
  const runActive     = useSurvivalStore((s) => s.runActive)
  const bankroll      = useSurvivalStore((s) => s.bankroll)
  const slotsUsed     = useSurvivalStore((s) => s.slotsUsed)
  const currentFloor  = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet   = useSurvivalStore((s) => s.floorMinBet)
  const recordResult  = useSurvivalStore((s) => s.recordResult)
  const advanceFloor  = useSurvivalStore((s) => s.advanceFloor)
  const endRun        = useSurvivalStore((s) => s.endRun)

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
      id: `roulette-${Date.now()}`,
      game: 'roulette',
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
      <RouletteGame mode="survival" bankroll={bankroll} onResolve={handleResolve} />
    </div>
  )
}
