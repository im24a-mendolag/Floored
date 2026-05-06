'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SurvivalStore, Difficulty, GameResult } from './types'
import { getFloorMinBet } from '@/utils/math'

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useSurvivalStore = create<SurvivalStore>()(
  persist(
    (set) => ({
      bankroll: 1000,
      setBankroll: (n) => set({ bankroll: n }),

      sparks: 0,
      addSparks: (n) => set((s) => ({ sparks: s.sparks + n })),
      spendSparks: (n) => set((s) => ({ sparks: Math.max(0, s.sparks - n) })),

      runActive: false,
      runSeed: null,
      gamesPlayed: 0,
      streak: 0,

      currentFloor: 1,
      slotsUsed: 0,
      floorMinBet: getFloorMinBet(1),

      diceConfig: { win: [], loss: [] },
      jackpotMeter: 0,
      difficulty: null,
      modifiers: [],
      history: [],

      startRun: (difficulty: Difficulty) =>
        set({
          bankroll: 1000,
          sparks: 0,
          runActive: true,
          runSeed: generateSeed(),
          gamesPlayed: 0,
          streak: 0,
          currentFloor: 1,
          slotsUsed: 0,
          floorMinBet: getFloorMinBet(1),
          diceConfig: { win: [], loss: [] },
          jackpotMeter: 0,
          difficulty,
          modifiers: [],
          history: [],
        }),

      endRun: () =>
        set({
          runActive: false,
          runSeed: null,
        }),

      advanceFloor: () =>
        set((s) => {
          const nextFloor = s.currentFloor + 1
          return {
            currentFloor: nextFloor,
            slotsUsed: 0,
            floorMinBet: getFloorMinBet(nextFloor),
          }
        }),

      recordResult: (result: GameResult) =>
        set((s) => ({
          gamesPlayed: s.gamesPlayed + 1,
          slotsUsed: s.slotsUsed + 1,
          streak: result.outcome === 'win' ? s.streak + 1 : 0,
          jackpotMeter: Math.min(100, s.jackpotMeter + (result.game === 'slots' ? 5 : 1)),
          history: [...s.history, result],
          bankroll: s.bankroll - result.betAmount + result.payout,
        })),
    }),
    { name: 'floored-survival' }
  )
)
