'use client'

import { PlinkoGame } from '@/components/plinko-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayPlinkoPage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const reset = useFreeplayStore((s) => s.reset)

  function handleResolve(result: { outcome: 'win' | 'loss' | 'push'; betAmount: number; payout: number; multiplier: number }) {
    const b = useFreeplayStore.getState().bankroll
    useFreeplayStore.getState().setBankroll(b - result.betAmount + result.payout)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0">
        <h1 className="text-xl font-bold">Plinko</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Freeplay — no floors, no pressure.</p>
      </div>

      {bankroll <= 0 && <BankruptModal onReset={reset} />}
      <PlinkoGame mode="freeplay" bankroll={Math.max(0, bankroll)} onResolve={handleResolve} />
    </div>
  )
}
