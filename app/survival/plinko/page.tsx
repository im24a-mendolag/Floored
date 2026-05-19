'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { PlinkoGame } from '@/components/plinko-game'

export default function SurvivalPlinkoPage() {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('plinko')

  return (
    <SurvivalGameWrapper currentGame="plinko">
      <PlinkoGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
