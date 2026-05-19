import type { GameMode } from '@/store/types'
import { useSurvivalStore } from '@/store/survival-store'

/** Call at the end of a game's handleNext when mode is survival. */
export function survivalAfterNext(mode: GameMode) {
  if (mode !== 'survival') return
  const { pendingDefeatReason, confirmPendingDefeat } = useSurvivalStore.getState()
  if (pendingDefeatReason) confirmPendingDefeat()
}
