'use client'

import { useSurvivalStore } from '@/store/survival-store'
import { isOpeningBetFreeAvailable } from '@/lib/survival/survival-perks'

/** True when Opening Ticket free first bet is still available this floor. */
export function useOpeningTicketActive(): boolean {
  return useSurvivalStore((s) =>
    isOpeningBetFreeAvailable({
      currentFloor: s.currentFloor,
      history: s.history,
      firstBetInsuranceUsed: s.firstBetInsuranceUsed,
      purchasedUpgrades: s.purchasedUpgrades,
      runActive: s.runActive,
    }),
  )
}
