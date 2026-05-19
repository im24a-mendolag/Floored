'use client'

import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's blessed status. */
export function useBless() {
  const blessed    = useSurvivalStore((s) => s.blessed)
  const setBlessed = useSurvivalStore((s) => s.setBlessed)
  return { blessed, setBlessed }
}
