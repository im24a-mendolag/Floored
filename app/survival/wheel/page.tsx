'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { WheelGame } from '@/components/wheel-game'

export default function SurvivalWheelPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('wheel')

  return (
    <SurvivalGameWrapper currentGame="wheel">
      <WheelGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
