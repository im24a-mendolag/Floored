'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { StreetCupsGame } from '@/components/street-cups-game'

export default function SurvivalStreetCupsPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('street-cups')

  return (
    <SurvivalGameWrapper currentGame="street-cups">
      <StreetCupsGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
