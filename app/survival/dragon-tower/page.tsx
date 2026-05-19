'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { DragonTowerGame } from '@/components/dragon-tower-game'

export default function SurvivalDragonTowerPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('dragon-tower')

  return (
    <SurvivalGameWrapper currentGame="dragon-tower">
      <DragonTowerGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
