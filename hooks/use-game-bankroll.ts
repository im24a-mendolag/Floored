'use client'

import { useCallback } from 'react'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import type { GameName } from '@/store/types'

export interface GameResolvePayload {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier?: number
}

export function useFreeplayGameBankroll() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const bust = useFreeplayStore((s) => s.bust)
  const reset = useFreeplayStore((s) => s.reset)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const markBust = useFreeplayStore((s) => s.markBust)

  const handleBet = useCallback(
    (amount: number) => {
      const b = useFreeplayStore.getState().bankroll
      setBankroll(b - amount)
    },
    [setBankroll],
  )

  const handleResolve = useCallback(
    (result: GameResolvePayload) => {
      const b = useFreeplayStore.getState().bankroll
      const newB = b + result.payout
      setBankroll(newB)
      if (newB <= 10) markBust()
    },
    [setBankroll, markBust],
  )

  return {
    bankroll: Math.max(0, bankroll),
    bust,
    reset,
    handleBet,
    handleResolve,
  }
}

export function useSurvivalGameBankroll(game: GameName) {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const deductBet = useSurvivalStore((s) => s.deductBet)
  const recordResultPayout = useSurvivalStore((s) => s.recordResultPayout)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const slotsUsed = useSurvivalStore((s) => s.slotsUsed)
  const advanceFloor = useSurvivalStore((s) => s.advanceFloor)
  const endRun = useSurvivalStore((s) => s.endRun)

  const handleBet = useCallback(
    (amount: number) => {
      deductBet(amount)
    },
    [deductBet],
  )

  const handleResolve = useCallback(
    (result: GameResolvePayload) => {
      const shouldAdvance = slotsUsed >= 2
      recordResultPayout({
        id: `${game}-${Date.now()}`,
        game,
        floor: currentFloor,
        betAmount: result.betAmount,
        payout: result.payout,
        outcome: result.outcome === 'push' ? 'push' : result.outcome,
        multiplier: result.multiplier,
        playedAt: new Date(),
      })
      if (shouldAdvance) advanceFloor()
      const nextBankroll = useSurvivalStore.getState().bankroll
      if (nextBankroll <= 0) endRun()
    },
    [game, currentFloor, slotsUsed, recordResultPayout, advanceFloor, endRun],
  )

  return { bankroll, handleBet, handleResolve }
}
