'use client'

import { useCallback, useState } from 'react'
import { perkRequiresProcRoll, rollPerkProc } from '@/lib/survival/perk-proc'

/**
 * Per-bet proc roll for strong “guaranteed safe” shop perks.
 * Call `rollForBet()` when a new bet/round starts; UI uses `perkActive` for highlights.
 */
export function usePerkProc(perkOwned: boolean, effectKey: string, level = 1) {
  const [active, setActive] = useState(false)

  const rollForBet = useCallback((): boolean => {
    if (!perkOwned || level <= 0) {
      setActive(false)
      return false
    }
    if (!perkRequiresProcRoll(effectKey)) {
      setActive(true)
      return true
    }
    const proc = rollPerkProc(effectKey, level)
    setActive(proc)
    return proc
  }, [perkOwned, effectKey, level])

  const resetPerk = useCallback(() => setActive(false), [])

  const perkEffective = perkOwned && level > 0 && (!perkRequiresProcRoll(effectKey) || active)

  return { perkActive: active, perkEffective, rollForBet, resetPerk }
}
