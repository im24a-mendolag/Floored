'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { RunDiceGame } from '@/components/run-dice-game'

export default function SurvivalRunDicePage() {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const diceConfig = useSurvivalStore((s) => s.diceConfig)
  const { handleBet, handleResolve } = useSurvivalGameBankroll('run-dice')

  return (
    <SurvivalGameWrapper currentGame="run-dice">
      <RunDiceGame
        mode="survival"
        bankroll={bankroll}
        config={diceConfig}
        onBet={handleBet}
        onResolve={handleResolve}
      />
    </SurvivalGameWrapper>
  )
}
