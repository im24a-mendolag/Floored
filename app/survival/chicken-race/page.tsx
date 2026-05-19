'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { ChickenRaceGame } from '@/components/chicken-race-game'

export default function SurvivalChickenRacePage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('chicken-race')

  return (
    <SurvivalGameWrapper currentGame="chicken-race">
      <ChickenRaceGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
