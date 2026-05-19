'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { ChickenGame } from '@/components/chicken-game'

export default function SurvivalChickenPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('chicken-road')

  return (
    <SurvivalGameWrapper currentGame="chicken-road">
      <ChickenGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
