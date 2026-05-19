'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { Poker1pGame } from '@/components/poker-1p-game'

export default function SurvivalPoker1pPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('poker-1p')

  return (
    <SurvivalGameWrapper currentGame="poker-1p">
      <Poker1pGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
