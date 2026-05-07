'use client'

import Link from 'next/link'
import { PlinkoGame } from '@/components/plinko-game'
import { useFreeplayStore } from '@/store/freeplay-store'
import { Button } from '@/components/ui/button'
import { formatChips } from '@/utils/format'

export default function FreeplayPlinkoPage() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const reset = useFreeplayStore((s) => s.reset)

  function handleResolve(result: { outcome: 'win' | 'loss' | 'push'; betAmount: number; payout: number; multiplier: number }) {
    setBankroll(bankroll - result.betAmount + result.payout)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plinko</h1>
          <p className="text-muted-foreground mt-1">Freeplay sandbox for the Plinko drop game.</p>
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-1">Bankroll {formatChips(bankroll)}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => reset()}>
              Reset Bankroll
            </Button>
            <Link href="/freeplay" className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              Back to Freeplay
            </Link>
          </div>
        </div>
      </div>

      {bankroll > 0 ? (
        <PlinkoGame mode="freeplay" bankroll={bankroll} onResolve={handleResolve} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          You have run out of freeplay chips. Reset to play again.
        </div>
      )}
    </div>
  )
}
