'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function FloorPanel() {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { currentFloor, floorMinBet, bankroll, quotaTarget, floorStartBankroll, quotaMet, floorComplete, runDefeated, sparks, endlessMode, abandonRun } = useSurvivalStore()

  const netProgress = bankroll - floorStartBankroll
  const netTarget = quotaTarget - floorStartBankroll
  const progressPct = netTarget <= 0
    ? 100
    : Math.min(100, Math.max(0, (netProgress / netTarget) * 100))

  const progressColor = quotaMet
    ? 'bg-amber-400'
    : bankroll < floorStartBankroll
      ? 'bg-red-500'
      : 'bg-emerald-500'

  return (
    <Card className="w-full">
      <CardContent className="py-3 px-4 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {/* Min bet — small, left-anchored */}
          <div className="shrink-0">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Min Bet</span>
            <div className="text-xs font-semibold text-muted-foreground leading-tight">
              {formatChips(floorMinBet)}
            </div>
          </div>

          {/* Floor + Quota + Sparks — big, centred */}
          <div className="flex flex-1 items-center justify-center gap-6">
            <div className="text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Floor</span>
              <div className="text-2xl font-black leading-tight">
                {currentFloor}
                <span className="text-sm font-normal text-muted-foreground">
                  {endlessMode ? ' ∞' : ' / 10'}
                </span>
              </div>
            </div>

            <div className="text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bankroll</span>
              <div className="text-2xl font-black tabular-nums leading-tight">
                <span className={bankroll >= quotaTarget ? 'text-foreground' : 'text-red-400'}>
                  {formatChips(bankroll)}
                </span>
                <span className="text-sm font-normal text-muted-foreground"> / {formatChips(quotaTarget)}</span>
              </div>
            </div>

            <div className="text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sparks</span>
              <div className="text-2xl font-black tabular-nums leading-tight text-amber-300">{formatChips(sparks)}</div>
            </div>
          </div>

          {/* Abandon — right-anchored */}
          <button
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 text-xs text-red-400 border border-red-900/50 rounded px-2.5 py-1 hover:bg-red-950/40 transition-colors"
          >
            Abandon
          </button>
        </div>

        <div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {quotaMet && !floorComplete && (
            <p className="text-xs text-amber-400 font-semibold text-center mt-1">
              Quota met — finish early from the navbar or keep playing until the timer ends
            </p>
          )}
          {floorComplete && (
            <p className="text-xs text-amber-400 font-semibold text-center mt-1">
              Time&apos;s up — quota met, collect your rewards
            </p>
          )}
          {runDefeated && (
            <p className="text-xs text-red-400 font-semibold text-center mt-1">
              Run over — tap Continue to return home
            </p>
          )}
        </div>

      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abandon this run?</DialogTitle>
            <DialogDescription>
              Progress, sparks, and upgrades for this run will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <button className="text-sm px-4 py-2 rounded border border-zinc-700 text-muted-foreground hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              onClick={() => {
                setConfirmOpen(false)
                abandonRun()
                router.push('/')
              }}
              className="text-sm px-4 py-2 rounded bg-red-900/60 border border-red-800 text-red-300 hover:bg-red-900 transition-colors"
            >
              Abandon run
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
