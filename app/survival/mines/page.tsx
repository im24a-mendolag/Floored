'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { MinesGame } from '@/components/mines-game'

export default function SurvivalMinesPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('mines')

  return (
    <SurvivalGameWrapper currentGame="mines">
      <MinesGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
