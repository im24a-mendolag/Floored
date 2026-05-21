'use client'

import { useCallback, useEffect } from 'react'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalStore } from '@/store/survival-store'
import type { GameMode } from '@/store/types'

/**
 * Survival defeat UI: bust (bankroll &lt; floor min bet) or floor bet quota exhausted.
 * Pass `idle: true` when the game is not mid-animation so Game Over can replace dock actions.
 */
export function useSurvivalGameOver(mode: GameMode, { idle }: { idle: boolean }) {
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const actualBankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const pendingDefeatReason = useSurvivalStore((s) => s.pendingDefeatReason)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const queueDefeat = useSurvivalStore((s) => s.queueDefeat)

  const isBusted = mode === 'survival' && actualBankroll < floorMinBet
  const noBetsLeft =
    mode === 'survival' &&
    floorBetsPlaced >= FLOOR_BET_LIMIT &&
    !floorComplete &&
    actualBankroll < quotaTarget
  const showGameOver =
    mode === 'survival' && idle && (pendingDefeatReason != null || isBusted || noBetsLeft)

  useEffect(() => {
    if (mode !== 'survival' || !idle || pendingDefeatReason != null || actualBankroll >= floorMinBet) {
      return
    }
    queueDefeat('bust')
  }, [mode, idle, pendingDefeatReason, actualBankroll, floorMinBet, queueDefeat])

  const handleGameOver = useCallback(() => {
    const state = useSurvivalStore.getState()
    if (state.pendingDefeatReason == null) {
      if (state.bankroll < state.floorMinBet) {
        state.queueDefeat('bust')
      } else if (
        state.floorBetsPlaced >= FLOOR_BET_LIMIT &&
        !state.floorComplete &&
        state.bankroll < state.quotaTarget
      ) {
        state.queueDefeat('quota')
      }
    }
    survivalAfterNext(mode)
  }, [mode])

  return { showGameOver, handleGameOver, isBusted, noBetsLeft }
}
