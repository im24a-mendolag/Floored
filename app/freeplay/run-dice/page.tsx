'use client'

import { RunDiceGame } from '@/components/run-dice-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayRunDicePage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const bust = useFreeplayStore((s) => s.bust)
  const markBust = useFreeplayStore((s) => s.markBust)
  const reset = useFreeplayStore((s) => s.reset)

  function handleResolve(result: {
    outcome: 'win' | 'loss' | 'push'
    betAmount: number
    payout: number
    multiplier: number
  }) {
    const newB = bankroll - result.betAmount + result.payout
    setBankroll(newB)
    if (newB <= 10) markBust()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <RunDiceGame mode="freeplay" bankroll={Math.max(0, bankroll)} onResolve={handleResolve} />
    </div>
  )
}
