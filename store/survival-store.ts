'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SurvivalStore, Difficulty, GameResult } from './types'
import { getFloorMinBet } from '@/utils/math'
import { generateRunDiceConfig } from '@/games/run-dice/engine'
import { generateFloor } from '@/lib/survival/floor-generator'
import { SURVIVAL_GAME_POOL } from '@/lib/survival/balance'
import { migratePersistedState } from '@/lib/survival/migrate'

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useSurvivalStore = create<SurvivalStore>()(
  persist(
    (set) => ({
      // ── Core run state defaults ─────────────────────────────────────────
      version: 1,
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

      diceConfig: { win: [], loss: [], neutral: [] },
      jackpotMeter: 0,
      difficulty: null,
      modifiers: [],
      history: [],
      peakBankroll: 1000,
      lastRun: null,

      // ── Per-floor generated state defaults ─────────────────────────────
      quotaTarget: 0,
      floorStartBankroll: 1000,
      floorGames: [],
      missions: [],
      completedMissionIds: [],
      purchasedUpgrades: [],
      inventory: [],
      floorHistory: [],
      floorComplete: false,

      // ── Actions ────────────────────────────────────────────────────────
      startRun: (difficulty: Difficulty) => {
        const runSeed = generateSeed()
        const floor1 = generateFloor({
          runSeed,
          floor: 1,
          difficulty,
          survivalGamePool: SURVIVAL_GAME_POOL,
        })
        set({
          version: 1,
          bankroll: 1000,
          sparks: 0,
          runActive: true,
          runSeed,
          gamesPlayed: 0,
          streak: 0,
          currentFloor: 1,
          slotsUsed: 0,
          floorMinBet: getFloorMinBet(1),
          diceConfig: generateRunDiceConfig(),
          jackpotMeter: 0,
          difficulty,
          modifiers: [],
          history: [],
          peakBankroll: 1000,
          lastRun: null,
          quotaTarget: floor1.quotaTarget,
          floorStartBankroll: 1000,
          floorGames: floor1.floorGames,
          missions: floor1.missions,
          completedMissionIds: [],
          purchasedUpgrades: [],
          inventory: [],
          floorHistory: [],
          floorComplete: false,
        })
      },

      abandonRun: () =>
        set({
          runActive: false,
          runSeed: null,
          lastRun: null,
          gamesPlayed: 0,
          streak: 0,
          currentFloor: 1,
          slotsUsed: 0,
          floorMinBet: getFloorMinBet(1),
          jackpotMeter: 0,
          difficulty: null,
          modifiers: [],
          history: [],
          peakBankroll: 1000,
          bankroll: 1000,
          sparks: 0,
          quotaTarget: 0,
          floorStartBankroll: 1000,
          floorGames: [],
          missions: [],
          completedMissionIds: [],
          purchasedUpgrades: [],
          inventory: [],
          floorHistory: [],
          floorComplete: false,
        }),

      endRun: () =>
        set((s) => ({
          runActive: false,
          runSeed: null,
          lastRun: {
            endedAt: new Date().toISOString(),
            endBankroll: s.bankroll,
            floorsReached: s.currentFloor,
            gamesPlayed: s.gamesPlayed,
            peakBankroll: s.peakBankroll,
            sparksEarned: s.sparks,
            difficulty: s.difficulty,
          },
        })),

      advanceFloor: () =>
        set((s) => {
          const nextFloor = s.currentFloor + 1
          const nextFloorData =
            s.runSeed && s.difficulty
              ? generateFloor({
                  runSeed: s.runSeed,
                  floor: nextFloor,
                  difficulty: s.difficulty,
                  survivalGamePool: SURVIVAL_GAME_POOL,
                })
              : { quotaTarget: s.quotaTarget, floorGames: s.floorGames, missions: s.missions }

          return {
            currentFloor: nextFloor,
            slotsUsed: 0,
            floorMinBet: getFloorMinBet(nextFloor),
            quotaTarget: nextFloorData.quotaTarget,
            floorStartBankroll: s.bankroll,
            floorGames: nextFloorData.floorGames,
            missions: nextFloorData.missions,
            floorComplete: false,
          }
        }),

      dismissFloorComplete: () => set({ floorComplete: false }),

      recordResult: (result: GameResult) =>
        set((s) => {
          const newBankroll = s.bankroll - result.betAmount + result.payout
          return {
            gamesPlayed: s.gamesPlayed + 1,
            slotsUsed: s.slotsUsed + 1,
            streak: result.outcome === 'win' ? s.streak + 1 : 0,
            jackpotMeter: Math.min(100, s.jackpotMeter + (result.game === 'slots' ? 5 : 1)),
            history: [...s.history, result],
            bankroll: newBankroll,
            peakBankroll: Math.max(s.peakBankroll, newBankroll),
          }
        }),

      // Bet already deducted via deductBet — only adds payout and records stats.
      recordResultPayout: (result: GameResult) =>
        set((s) => {
          const newBankroll = s.bankroll + result.payout
          const quotaJustMet = !s.floorComplete && newBankroll >= s.quotaTarget
          return {
            gamesPlayed: s.gamesPlayed + 1,
            slotsUsed: s.slotsUsed + 1,
            streak: result.outcome === 'win' ? s.streak + 1 : 0,
            jackpotMeter: Math.min(100, s.jackpotMeter + (result.game === 'slots' ? 5 : 1)),
            history: [...s.history, result],
            bankroll: newBankroll,
            peakBankroll: Math.max(s.peakBankroll, newBankroll),
            floorComplete: quotaJustMet || s.floorComplete,
          }
        }),

      deductBet: (amount: number) =>
        set((s) => ({ bankroll: s.bankroll - amount })),

      resetJackpotMeter: () => set({ jackpotMeter: 0 }),
    }),
    {
      name: 'floored-survival',
      version: 1,
      migrate: (persistedState: unknown, fromVersion: number): unknown =>
        migratePersistedState(persistedState, fromVersion),
    },
  ),
)
