'use client'

import { CaseBattlesGame } from '@/components/case-battles-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayGameBankroll } from '@/hooks/use-game-bankroll'

export default function FreeplayCaseBattlesPage() {
  const { bankroll, bust, reset, handleBet, handleResolve } = useFreeplayGameBankroll()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <CaseBattlesGame
        mode="freeplay"
        bankroll={bankroll}
        onBet={handleBet}
        onResolve={handleResolve}
      />
    </div>
  )
}
