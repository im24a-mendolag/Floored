'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { CaseBattlesGame } from '@/components/case-battles-game'

export default function SurvivalCaseBattlesPage() {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('case-battles')

  return (
    <SurvivalGameWrapper currentGame="case-battles">
      <CaseBattlesGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
