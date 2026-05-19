'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { CoinFlipGame } from '@/components/coin-flip-game'

export default function SurvivalCoinFlipPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('coin-flip')

  return (
    <SurvivalGameWrapper currentGame="coin-flip">
      <CoinFlipGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
