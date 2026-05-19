'use client'

import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { HiLoGame } from '@/components/hilo-game'

export default function SurvivalHiloPage() {
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll('hilo')

  return (
    <SurvivalGameWrapper currentGame="hilo">
      <HiLoGame mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
