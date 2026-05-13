'use client'

import { ChickenGame } from '@/components/chicken-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayChickenPage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const bust = useFreeplayStore((s) => s.bust)
  const markBust = useFreeplayStore((s) => s.markBust)
  const reset = useFreeplayStore((s) => s.reset)

  function handleResolve(result: {
    outcome: 'win' | 'loss'
    betAmount: number
    payout: number
    multiplier: number
  }) {
    const newB = bankroll - result.betAmount + result.payout
    setBankroll(newB)
    if (newB <= 10) markBust()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chicken Road</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Freeplay — no floors, no pressure.</p>
      </div>

      {bust && <BankruptModal onReset={reset} />}
      <ChickenGame mode="freeplay" bankroll={Math.max(0, bankroll)} onResolve={handleResolve} />
    </div>
  )
}
