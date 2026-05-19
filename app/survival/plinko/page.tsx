'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { PlinkoGame } from '@/components/plinko-game'

export default function SurvivalPlinkoPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('plinko')

  return (
    <SurvivalGameWrapper currentGame="plinko">
      <PlinkoGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
