'use client'

import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's cursed status. */
export function useCurse() {
  const cursed = useSurvivalStore((s) => s.cursed)
  const setCursed = useSurvivalStore((s) => s.setCursed)
  return { cursed, setCursed }
}
