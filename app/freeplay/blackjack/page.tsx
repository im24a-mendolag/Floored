'use client'

import { useRouter } from 'next/navigation'
import { BlackjackGame } from '@/components/blackjack-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function FreeplayBlackjackPage() {
  const router = useRouter()
  const bankroll = useFreeplayStore((s) => s.bankroll)
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
    if (result.payout > 0) {
      const b = useFreeplayStore.getState().bankroll
      useFreeplayStore.getState().setBankroll(b + result.payout)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0">
        <h1 className="text-xl font-bold">Blackjack</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Freeplay — no floors, no pressure.</p>
        <button
          type="button"
          onClick={() => router.push('/freeplay')}
          className="mt-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          ← Back
        </button>
      </div>

      {bankroll <= 0 && <BankruptModal onReset={reset} />}
      <BlackjackGame mode="freeplay" bankroll={Math.max(0, bankroll)} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
