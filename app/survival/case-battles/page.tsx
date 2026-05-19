'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { CaseBattlesGame } from '@/components/case-battles-game'

export default function SurvivalCaseBattlesPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('case-battles')

  return (
    <SurvivalGameWrapper currentGame="case-battles">
      <CaseBattlesGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
