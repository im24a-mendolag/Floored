'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BlackjackGame } from '@/components/blackjack-game'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'

export default function SurvivalBlackjackPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const slotsUsed = useSurvivalStore((s) => s.slotsUsed)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('blackjack')

  useEffect(() => {
    if (!runActive) router.replace('/survival')
  }, [runActive, router])

  if (!runActive) return null

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

      <BlackjackGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
