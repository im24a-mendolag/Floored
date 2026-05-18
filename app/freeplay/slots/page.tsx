'use client'

import { SlotsGame } from '@/components/slots-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayGameBankroll } from '@/hooks/use-game-bankroll'

export default function FreeplaySlotsPage() {
  const { bankroll, bust, reset, handleBet, handleResolve } = useFreeplayGameBankroll()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <SlotsGame mode="freeplay" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
