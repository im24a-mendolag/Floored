'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'

export function FloorPanel() {
  const { currentFloor, floorMinBet, quotaProgress, quotaTarget, floorComplete } = useSurvivalStore()

  const progressPct = quotaTarget > 0
    ? Math.min(100, Math.max(0, (quotaProgress / quotaTarget) * 100))
    : 0

  const progressColor = floorComplete
    ? 'bg-amber-400'
    : quotaProgress < 0
      ? 'bg-red-500'
      : 'bg-emerald-500'

  return (
    <Card className="w-full">
      <CardContent className="pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Floor</span>
            <span className="text-3xl font-bold">{currentFloor} <span className="text-base font-normal text-muted-foreground">/ 10</span></span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Min Bet</span>
            <span className="text-xl font-semibold text-foreground">
              {formatChips(floorMinBet)}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Quota</span>
            <span className="text-xl font-semibold tabular-nums">
              <span className={quotaProgress >= 0 ? 'text-foreground' : 'text-red-400'}>
                {quotaProgress >= 0 ? '+' : ''}{formatChips(quotaProgress)}
              </span>
              <span className="text-muted-foreground text-base font-normal"> / {formatChips(quotaTarget)}</span>
            </span>
          </div>
        </div>

        {/* Quota progress bar */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {floorComplete && (
            <p className="text-xs text-amber-400 font-semibold text-center">
              Quota reached — complete the floor!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
