'use client'

import { RouletteGame } from '@/components/roulette-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayGameBankroll } from '@/hooks/use-game-bankroll'

export default function FreeplayRoulettePage() {
  const { bankroll, bust, reset, handleBet, handleResolve } = useFreeplayGameBankroll()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <RouletteGame mode="freeplay" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
