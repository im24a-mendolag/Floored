'use client'

import { DragonTowerGame } from '@/components/dragon-tower-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayGameBankroll } from '@/hooks/use-game-bankroll'

export default function FreeplayDragonTowerPage() {
  const { bankroll, bust, reset, handleBet, handleResolve } = useFreeplayGameBankroll()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <DragonTowerGame
        mode="freeplay"
        bankroll={bankroll}
        onBet={handleBet}
        onResolve={handleResolve}
      />
    </div>
  )
}
