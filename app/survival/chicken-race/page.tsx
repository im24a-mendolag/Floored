'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { ChickenRaceGame } from '@/components/chicken-race-game'

export default function SurvivalChickenRacePage() {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('chicken-race')

  return (
    <SurvivalGameWrapper currentGame="chicken-race">
      <ChickenRaceGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
