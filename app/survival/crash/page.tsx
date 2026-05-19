'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { CrashGame } from '@/components/crash-game'

export default function SurvivalCrashPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('crash')

  return (
    <SurvivalGameWrapper currentGame="crash">
      <CrashGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
