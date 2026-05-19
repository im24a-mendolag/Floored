'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { OverUnderGame } from '@/components/over-under-game'

export default function SurvivalOverUnderPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('over-under')

  return (
    <SurvivalGameWrapper currentGame="over-under">
      <OverUnderGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
