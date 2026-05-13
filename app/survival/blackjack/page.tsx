'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BlackjackGame } from '@/components/blackjack-game'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalBlackjackPage() {
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

  function handleResolve(result: {
    outcome: 'win' | 'loss' | 'push'
    betAmount: number
    payout: number
    multiplier: number
  }) {
    const shouldAdvance = slotsUsed >= 2
    recordResultPayout({
      id: `blackjack-${Date.now()}`,
      game: 'blackjack',
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

    if (useSurvivalStore.getState().bankroll <= 0) {
      endRun()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Blackjack</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Beat the dealer before the floor advances.</p>
          <button
            type="button"
            onClick={() => router.push('/survival')}
            className="mt-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ← Back
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Floor {currentFloor}</span>
          <span className="text-zinc-700">·</span>
          <span>Min {formatChips(floorMinBet)}</span>
          <span className="text-zinc-700">·</span>
          <span>{slotsUsed}/3 slots</span>
        </div>
      </div>

      <BlackjackGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
