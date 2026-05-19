'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { BlackjackGame } from '@/components/blackjack-game'

export default function SurvivalBlackjackPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('blackjack')

  return (
    <SurvivalGameWrapper currentGame="blackjack">
      <BlackjackGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
