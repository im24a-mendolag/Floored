'use client'

import { useCallback, useMemo } from 'react'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import type { GameName } from '@/store/types'
import { applyResolveModifiers } from '@/lib/survival/apply-modifiers'
import { evaluateMissionsOnGame } from '@/lib/survival/mission-evaluator'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import { hasFreeFirstBet, survivalWagerCap } from '@/lib/survival/survival-perks'

export interface GameResolvePayload {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier?: number
}

export interface ResolvedGamePayload extends GameResolvePayload {
  payoutBoostMult?: number
  firstBetWasFree?: boolean
}

/** Game `onResolve` prop — bankroll hooks may return boosted payout fields. */
export type GameResolveFn<R extends GameResolvePayload = GameResolvePayload> = (
  result: R,
) => R | ResolvedGamePayload | void

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
    <R extends GameResolvePayload>(result: R): R => {
      const b = useFreeplayStore.getState().bankroll
      const newB = b + result.payout
      setBankroll(newB)
      if (newB <= 10) markBust()
      return result
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
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const openingBetFree = useOpeningTicketActive()
  const deductBet = useSurvivalStore((s) => s.deductBet)
  const recordResultPayout = useSurvivalStore((s) => s.recordResultPayout)
  const applyMissionResults = useSurvivalStore((s) => s.applyMissionResults)

  const wagerCap = useMemo(
    () => survivalWagerCap(bankroll, openingBetFree, floorMinBet),
    [bankroll, openingBetFree, floorMinBet],
  )

  const handleBet = useCallback(
    (amount: number) => {
      const before = useSurvivalStore.getState()
      const isFirstBetThisFloor = before.history.filter((h) => h.floor === currentFloor).length === 0
      const isFree =
        isFirstBetThisFloor &&
        !before.firstBetInsuranceUsed &&
        hasFreeFirstBet(before.purchasedUpgrades)

      if (isFree) {
        useSurvivalStore.setState({ firstBetInsuranceUsed: true })
        return
      }
      deductBet(amount)
    },
    [currentFloor, deductBet],
  )

  const handleResolve = useCallback(
    <R extends GameResolvePayload>(result: R): R & ResolvedGamePayload => {
      const before = useSurvivalStore.getState()
      const isFirstBetThisFloor = before.history.filter((h) => h.floor === currentFloor).length === 0
      const wasFreeBet =
        isFirstBetThisFloor &&
        before.firstBetInsuranceUsed &&
        hasFreeFirstBet(before.purchasedUpgrades)

      const adjusted = applyResolveModifiers(
        { ...result, game },
        {
          purchasedUpgrades: before.purchasedUpgrades,
          difficulty: before.difficulty,
          wasFreeBet,
        },
      )

      recordResultPayout({
        id: `${game}-${Date.now()}`,
        game,
        floor: currentFloor,
        betAmount: result.betAmount,
        payout: adjusted.payout,
        outcome: result.outcome === 'push' ? 'push' : result.outcome,
        multiplier: adjusted.multiplier ?? result.multiplier,
        playedAt: new Date(),
      })

      const after = useSurvivalStore.getState()
      const gamesPlayedThisFloor = after.history.filter((h) => h.floor === currentFloor).length

      const updatedMissions = evaluateMissionsOnGame(after.missions, {
        game,
        floor: currentFloor,
        betAmount: result.betAmount,
        payout: adjusted.payout,
        outcome: result.outcome === 'push' ? 'push' : result.outcome,
        multiplier: adjusted.multiplier ?? result.multiplier,
        bankroll: after.bankroll,
        floorStartBankroll: after.floorStartBankroll,
        streak: after.streak,
        gamesPlayedThisFloor,
      })

      applyMissionResults(updatedMissions)

      const finalBankroll = useSurvivalStore.getState().bankroll
      if (finalBankroll <= 0) useSurvivalStore.getState().queueDefeat('bust')

      return {
        ...result,
        payout: adjusted.payout,
        multiplier: adjusted.multiplier ?? result.multiplier,
        payoutBoostMult: adjusted.payoutBoostMult,
        firstBetWasFree: adjusted.firstBetWasFree,
      }
    },
    [game, currentFloor, recordResultPayout, applyMissionResults],
  )

  return { bankroll, wagerCap, openingBetFree, handleBet, handleResolve }
}
