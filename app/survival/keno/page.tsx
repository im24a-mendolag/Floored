'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { KenoGame } from '@/components/keno-game'

export default function SurvivalKenoPage() {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('keno')

  return (
    <SurvivalGameWrapper currentGame="keno">
      <KenoGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
