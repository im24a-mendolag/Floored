'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { Button } from '@/components/ui/button'
import { useFloorTimeRemainingMs, formatFloorTime } from '@/hooks/use-floor-timer'
import { formatChips } from '@/utils/format'

export function FloorPauseModal() {
  const runActive = useSurvivalStore((s) => s.runActive)
  const floorTimerPaused = useSurvivalStore((s) => s.floorTimerPaused)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const toggleFloorTimerPause = useSurvivalStore((s) => s.toggleFloorTimerPause)

  const floorTimeRemainingMs = useFloorTimeRemainingMs()
  const open = runActive && floorTimerPaused && !floorComplete && !runDefeated

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="floor-pause-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl flex flex-col gap-5 text-center">
        <div className="space-y-2">
          <h2 id="floor-pause-title" className="text-xl font-bold text-white">
            Floor Paused
          </h2>
          <p className="text-sm text-zinc-400">
            The timer is stopped. Resume to keep playing this floor.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 tabular-nums text-sm font-bold text-zinc-200">
            {formatChips(bankroll)}
          </div>
          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 tabular-nums text-sm font-bold text-amber-300">
            {formatFloorTime(floorTimeRemainingMs)}
          </div>
        </div>

        <Button onClick={() => toggleFloorTimerPause()} className="w-full" size="lg">
          Resume
        </Button>
      </div>
    </div>
  )
}
