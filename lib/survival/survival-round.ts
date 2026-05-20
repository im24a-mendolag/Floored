import type { GameMode } from '@/store/types'
import { useSurvivalStore } from '@/store/survival-store'

/**
 * Call when the player leaves a settled round (Next / Continue).
 * Returns false when a pending defeat was confirmed — caller must not start a new round.
 */
export function survivalAfterNext(mode: GameMode): boolean {
  if (mode !== 'survival') return true
  const { pendingDefeatReason, confirmPendingDefeat } = useSurvivalStore.getState()
  if (pendingDefeatReason) {
    confirmPendingDefeat()
    return false
  }
  return true
}
