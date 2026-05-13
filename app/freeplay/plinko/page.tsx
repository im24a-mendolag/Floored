'use client'

import { PlinkoGame } from '@/components/plinko-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayPlinkoPage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const reset = useFreeplayStore((s) => s.reset)

  function handleBet(amount: number) {
    const b = useFreeplayStore.getState().bankroll
    useFreeplayStore.getState().setBankroll(b - amount)
  }

  function handleResolve(result: { outcome: 'win' | 'loss' | 'push'; betAmount: number; payout: number; multiplier: number }) {
    if (result.payout > 0) {
      const b = useFreeplayStore.getState().bankroll
      useFreeplayStore.getState().setBankroll(b + result.payout)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bankroll <= 0 && <BankruptModal onReset={reset} />}
      <PlinkoGame mode="freeplay" bankroll={Math.max(0, bankroll)} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
