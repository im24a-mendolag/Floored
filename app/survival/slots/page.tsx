'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { SlotsGame } from '@/components/slots-game'

export default function SurvivalSlotsPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('slots')

  return (
    <SurvivalGameWrapper currentGame="slots">
      <SlotsGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
