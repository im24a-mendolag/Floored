'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { SlotsGame } from '@/components/slots-game'

export default function SurvivalSlotsPage() {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('slots')

  return (
    <SurvivalGameWrapper currentGame="slots">
      <SlotsGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
