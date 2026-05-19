'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { RouletteGame } from '@/components/roulette-game'

export default function SurvivalRoulettePage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('roulette')

  return (
    <SurvivalGameWrapper currentGame="roulette">
      <RouletteGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
