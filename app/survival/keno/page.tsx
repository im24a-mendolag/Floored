'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { KenoGame } from '@/components/keno-game'

export default function SurvivalKenoPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('keno')

  return (
    <SurvivalGameWrapper currentGame="keno">
      <KenoGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
