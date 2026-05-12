'use client'

import { HiloGame } from '@/components/hilo-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayHiloPage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const reset = useFreeplayStore((s) => s.reset)

  function handleResolve(result: {
    outcome: 'win' | 'loss'
    betAmount: number
    payout: number
    multiplier: number
  }) {
    setBankroll(bankroll - result.betAmount + result.payout)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hi-Lo</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Freeplay — no floors, no pressure.</p>
      </div>

      {bankroll <= 0 && <BankruptModal onReset={reset} />}
      <HiloGame mode="freeplay" bankroll={Math.max(0, bankroll)} onResolve={handleResolve} />
    </div>
  )
}
