'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { sparkFloorMult } from '@/lib/survival/balance'
import { MAX_FLOORS } from '@/lib/survival/balance'

function calcSparksEarned(floor: number, quotaProgress: number, quotaTarget: number): number {
  const base = Math.floor((8 + 2 * floor) * sparkFloorMult(floor))
  if (quotaTarget <= 0 || quotaProgress <= quotaTarget) return base
  const overRatio = Math.min(2, (quotaProgress - quotaTarget) / quotaTarget)
  return Math.floor(base * (1 + overRatio))
}

export function FloorCompleteModal() {
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const quotaProgress = useSurvivalStore((s) => s.quotaProgress)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const advanceFloor = useSurvivalStore((s) => s.advanceFloor)
  const addSparks = useSurvivalStore((s) => s.addSparks)
  const endRun = useSurvivalStore((s) => s.endRun)

  const isVictory = currentFloor >= MAX_FLOORS
  const sparksEarned = calcSparksEarned(currentFloor, quotaProgress, quotaTarget)
  const overQuota = Math.max(0, quotaProgress - quotaTarget)

  function handleContinue() {
    addSparks(sparksEarned)
    if (isVictory) {
      endRun()
    } else {
      advanceFloor()
    }
  }

  return (
    <Dialog open={floorComplete} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className={isVictory ? 'text-amber-400 text-2xl' : ''}>
            {isVictory ? '🏆 Victory!' : `Floor ${currentFloor} Complete!`}
          </DialogTitle>
          <DialogDescription>
            {isVictory
              ? 'You cleared all 10 floors. Incredible run!'
              : `Quota met — collect your sparks and head to floor ${currentFloor + 1}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quota target</span>
              <span className="font-semibold">{formatChips(quotaTarget)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net profit</span>
              <span className="font-semibold text-emerald-400">+{formatChips(quotaProgress)}</span>
            </div>
            {overQuota > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Over quota</span>
                <span className="font-semibold text-amber-400">+{formatChips(overQuota)}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-muted-foreground">Sparks earned</span>
              <span className="font-bold text-amber-400">✦ {sparksEarned}</span>
            </div>
          </div>

          <Button onClick={handleContinue} className="w-full">
            {isVictory ? 'Finish Run' : `Advance to Floor ${currentFloor + 1}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
