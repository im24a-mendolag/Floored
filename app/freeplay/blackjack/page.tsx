'use client'

import { BlackjackGame } from '@/components/blackjack-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayBlackjackPage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const bust = useFreeplayStore((s) => s.bust)
  const reset = useFreeplayStore((s) => s.reset)

  function handleBet(amount: number) {
    const b = useFreeplayStore.getState().bankroll
    useFreeplayStore.getState().setBankroll(b - amount)
  }

  function handleResolve(result: {
    outcome: 'win' | 'loss' | 'push'
    betAmount: number
    payout: number
    multiplier: number
  }) {
    const { bankroll: b, setBankroll, markBust } = useFreeplayStore.getState()
    const newB = b + result.payout
    if (result.payout > 0) setBankroll(newB)
    if (newB <= 10) markBust()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <BlackjackGame mode="freeplay" bankroll={Math.max(0, bankroll)} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
