'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'

export function FloorPanel() {
  const { currentFloor, floorMinBet, slotsUsed } = useSurvivalStore()
  const slotsRemaining = 3 - slotsUsed

  return (
    <Card className="w-full">
      <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Floor</span>
          <span className="text-3xl font-bold">{currentFloor}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Min Bet</span>
          <span className="text-xl font-semibold text-yellow-400">
            {formatChips(floorMinBet)}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Slots Remaining
          </span>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-sm ${
                  i < slotsRemaining ? 'bg-emerald-500' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
