'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'

/** Ticks the floor countdown and triggers floor complete when time runs out. */
export function useFloorTimer() {
  const pathname = usePathname()
  const inSurvival = pathname?.startsWith('/survival') ?? false
  const runActive = useSurvivalStore((s) => s.runActive)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const floorTimerPaused = useSurvivalStore((s) => s.floorTimerPaused)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const syncFloorTimer = useSurvivalStore((s) => s.syncFloorTimer)
  const completeFloorFromTimer = useSurvivalStore((s) => s.completeFloorFromTimer)
  const devTimerFrozen = useSettingsStore((s) => s.devTimerFrozen)

  useEffect(() => {
    if (!inSurvival || !runActive || floorComplete || floorTimerPaused || runDefeated || devTimerFrozen) return

    const id = window.setInterval(() => {
      const remaining = syncFloorTimer()
      if (remaining <= 0) completeFloorFromTimer()
    }, 1000)

    return () => window.clearInterval(id)
  }, [inSurvival, runActive, floorComplete, floorTimerPaused, runDefeated, devTimerFrozen, syncFloorTimer, completeFloorFromTimer])
}

/** Live remaining ms for display (accounts for elapsed time while unpaused). */
export function useFloorTimeRemainingMs(): number {
  const pathname = usePathname()
  const inSurvival = pathname?.startsWith('/survival') ?? false
  const runActive = useSurvivalStore((s) => s.runActive)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const floorTimeRemainingMs = useSurvivalStore((s) => s.floorTimeRemainingMs)
  const floorTimerPaused = useSurvivalStore((s) => s.floorTimerPaused)
  const floorTimerSyncedAt = useSurvivalStore((s) => s.floorTimerSyncedAt)
  const devTimerFrozen = useSettingsStore((s) => s.devTimerFrozen)

  const [, setTick] = useState(0)

  useEffect(() => {
    if (!inSurvival || !runActive || floorComplete || floorTimerPaused || devTimerFrozen) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [inSurvival, runActive, floorComplete, floorTimerPaused, devTimerFrozen])

  if (!inSurvival || !runActive || floorComplete || floorTimerPaused || devTimerFrozen) return floorTimeRemainingMs
  return Math.max(0, floorTimeRemainingMs - (Date.now() - floorTimerSyncedAt))
}

export function formatFloorTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
