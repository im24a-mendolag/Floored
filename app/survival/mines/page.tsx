'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { MinesGame } from '@/components/mines-game'

export default function SurvivalMinesPage() {
  const { bankroll, handleBet, handleResolve } = useSurvivalGameBankroll('mines')

  return (
    <SurvivalGameWrapper currentGame="mines">
      <MinesGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
