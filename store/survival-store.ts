'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SurvivalStore, Difficulty, GameResult, FloorRecord, DefeatReason } from './types'
import { getFloorMinBet } from '@/utils/math'
import { generateRunDiceConfig } from '@/games/run-dice/engine'
import { generateFloor } from '@/lib/survival/floor-generator'
import { MAX_FLOORS, SURVIVAL_GAME_POOL, FLOOR_DURATION_MS, calcShopRerollCost, calcMissionRerollCost, calcShopPrice, GRANT_ALL_UPGRADES } from '@/lib/survival/balance'
import { migratePersistedState } from '@/lib/survival/migrate'
import { allPurchasedUpgradesForDev, getCatalogItem } from '@/lib/survival/upgrades-catalog'
import {
  LOBBY_REROLL_TICKET,
  LOBBY_REROLL_TICKET_ID,
  rerollLobbySlot,
} from '@/lib/survival/lobby-ticket'
import { canPurchaseUpgrade } from '@/lib/survival/upgrade-levels'
import { normalizeUpgradeId } from '@/lib/survival/upgrades-catalog'
import { generateMissionsForFloor } from '@/lib/survival/missions'
import { canRerollMissions } from '@/lib/survival/mission-reroll'

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function initialFloorTimerState() {
  return {
    floorTimeRemainingMs: FLOOR_DURATION_MS,
    floorTimerPaused: false,
    floorTimerSyncedAt: Date.now(),
    quotaMet: false,
  }
}

const RUN_PERSIST_KEYS = [
  'version',
  'bankroll',
  'sparks',
  'runActive',
  'runSeed',
  'gamesPlayed',
  'streak',
  'currentFloor',
  'floorMinBet',
  'diceConfig',
  'jackpotMeter',
  'difficulty',
  'modifiers',
  'history',
  'peakBankroll',
  'lastRun',
  'quotaTarget',
  'floorStartBankroll',
  'floorGames',
  'missions',
  'completedMissionIds',
  'purchasedUpgrades',
  'inventory',
  'floorHistory',
  'floorComplete',
  'runDefeated',
  'defeatReason',
  'pendingDefeatReason',
  'quotaMet',
  'floorTimeRemainingMs',
  'floorTimerPaused',
  'floorTimerSyncedAt',
  'firstBetInsuranceUsed',
  'shopRerollCount',
  'missionRerollCount',
  'lobbyRerollCount',
  'endlessMode',
  'cursed',
] as const

export const useSurvivalStore = create<SurvivalStore>()(
  persist(
    (set, get) => ({
      version: 4,
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

      quotaTarget: 0,
      floorStartBankroll: 1000,
      floorGames: [],
      missions: [],
      completedMissionIds: [],
      purchasedUpgrades: [],
      inventory: [],
      floorHistory: [],
      floorComplete: false,
      runDefeated: false,
      defeatReason: null,
      pendingDefeatReason: null,
      firstBetInsuranceUsed: false,
      shopRerollCount: 0,
      missionRerollCount: 0,
      lobbyRerollCount: 0,
      endlessMode: false,
      cursed: false,
      ...initialFloorTimerState(),

      startRun: (difficulty: Difficulty) => {
        const runSeed = generateSeed()
        const floor1 = generateFloor({
          runSeed,
          floor: 1,
          difficulty,
          survivalGamePool: SURVIVAL_GAME_POOL,
        })
        set({
          version: 4,
          bankroll: 1_000_000,
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
          peakBankroll: 1_000_000,
          lastRun: null,
          quotaTarget: floor1.quotaTarget,
          floorStartBankroll: 1_000_000,
          floorGames: floor1.floorGames,
          missions: floor1.missions,
          completedMissionIds: [],
          purchasedUpgrades: GRANT_ALL_UPGRADES ? allPurchasedUpgradesForDev() : [],
          inventory: GRANT_ALL_UPGRADES ? [{ id: 'reroll_floor_game', count: 99 }] : [],
          floorHistory: [],
          floorComplete: false,
          runDefeated: false,
          defeatReason: null,
          pendingDefeatReason: null,
          firstBetInsuranceUsed: false,
          shopRerollCount: 0,
          missionRerollCount: 0,
          lobbyRerollCount: 0,
          endlessMode: false,
          cursed: false,
          ...initialFloorTimerState(),
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
          runDefeated: false,
          defeatReason: null,
          pendingDefeatReason: null,
          firstBetInsuranceUsed: false,
          shopRerollCount: 0,
          missionRerollCount: 0,
          lobbyRerollCount: 0,
          endlessMode: false,
          cursed: false,
          ...initialFloorTimerState(),
        }),

      endRun: (opts) =>
        set((s) => ({
          runActive: false,
          runSeed: null,
          floorComplete: false,
          runDefeated: false,
          defeatReason: null,
          pendingDefeatReason: null,
          lastRun: {
            endedAt: new Date().toISOString(),
            endBankroll: s.bankroll,
            floorsReached: opts?.victory ? MAX_FLOORS : s.currentFloor,
            gamesPlayed: s.gamesPlayed,
            peakBankroll: s.peakBankroll,
            sparksEarned: s.sparks,
            difficulty: s.difficulty,
            victory: opts?.victory ?? false,
            endlessMode: s.endlessMode,
          },
          endlessMode: false,
        })),

      advanceFloor: () =>
        set((s) => {
          if (s.currentFloor >= MAX_FLOORS && !s.endlessMode) return s

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
            firstBetInsuranceUsed: false,
            shopRerollCount: 0,
            missionRerollCount: 0,
            lobbyRerollCount: 0,
            ...initialFloorTimerState(),
            quotaMet: s.bankroll >= nextFloorData.quotaTarget,
          }
        }),

      continueToEndless: () =>
        set((s) => {
          if (s.currentFloor !== MAX_FLOORS || s.endlessMode) return s

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
            endlessMode: true,
            currentFloor: nextFloor,
            slotsUsed: 0,
            floorMinBet: getFloorMinBet(nextFloor),
            quotaTarget: nextFloorData.quotaTarget,
            floorStartBankroll: s.bankroll,
            floorGames: nextFloorData.floorGames,
            missions: nextFloorData.missions,
            floorComplete: false,
            firstBetInsuranceUsed: false,
            shopRerollCount: 0,
            missionRerollCount: 0,
            lobbyRerollCount: 0,
            ...initialFloorTimerState(),
            quotaMet: s.bankroll >= nextFloorData.quotaTarget,
          }
        }),

      dismissFloorComplete: () => set({ floorComplete: false }),

      syncFloorTimer: () => {
        const s = get()
        if (s.floorTimerPaused || s.floorComplete || s.runDefeated) return s.floorTimeRemainingMs
        const elapsed = Date.now() - s.floorTimerSyncedAt
        const remaining = Math.max(0, s.floorTimeRemainingMs - elapsed)
        set({ floorTimeRemainingMs: remaining, floorTimerSyncedAt: Date.now() })
        return remaining
      },

      toggleFloorTimerPause: () =>
        set((s) => {
          if (s.floorComplete || s.runDefeated) return s
          if (!s.floorTimerPaused) {
            const elapsed = Date.now() - s.floorTimerSyncedAt
            const remaining = Math.max(0, s.floorTimeRemainingMs - elapsed)
            return {
              floorTimerPaused: true,
              floorTimeRemainingMs: remaining,
            }
          }
          return {
            floorTimerPaused: false,
            floorTimerSyncedAt: Date.now(),
          }
        }),

      completeFloorFromTimer: () =>
        set((s) => {
          if (s.floorComplete || s.runDefeated) return s
          const elapsed = s.floorTimerPaused ? 0 : Date.now() - s.floorTimerSyncedAt
          const remaining = Math.max(0, s.floorTimeRemainingMs - elapsed)

          if (s.bankroll >= s.quotaTarget) {
            return {
              floorComplete: true,
              floorTimeRemainingMs: remaining,
              floorTimerPaused: true,
            }
          }

          return {
            runDefeated: true,
            defeatReason: 'quota' as DefeatReason,
            floorTimeRemainingMs: 0,
            floorTimerPaused: true,
          }
        }),

      finishQuotaEarly: () =>
        set((s) => {
          if (s.floorComplete || s.runDefeated || !s.quotaMet || s.bankroll < s.quotaTarget) return s
          const elapsed = s.floorTimerPaused ? 0 : Date.now() - s.floorTimerSyncedAt
          const remaining = Math.max(0, s.floorTimeRemainingMs - elapsed)
          return {
            floorComplete: true,
            floorTimeRemainingMs: remaining,
            floorTimerPaused: true,
          }
        }),

      queueDefeat: (reason: DefeatReason) =>
        set({ pendingDefeatReason: reason }),

      confirmPendingDefeat: () =>
        set((s) => {
          if (!s.pendingDefeatReason) return s
          return {
            runDefeated: true,
            defeatReason: s.pendingDefeatReason,
            pendingDefeatReason: null,
            floorTimerPaused: true,
          }
        }),

      setRunDefeated: (reason: DefeatReason) =>
        set({
          runDefeated: true,
          defeatReason: reason,
          pendingDefeatReason: null,
          floorTimerPaused: true,
        }),

      confirmDefeat: () => {
        get().abandonRun()
      },

      clearLastRun: () => set({ lastRun: null }),

      setMissions: (missions) => set({ missions }),

      applyMissionResults: (updatedMissions) =>
        set((s) => {
          const newlyCompleted = updatedMissions.filter(
            (m) => m.completed && !s.missions.find((prev) => prev.id === m.id)?.completed,
          )
          const sparkRewards = newlyCompleted.reduce((sum, m) => sum + m.rewardSparks, 0)
          return {
            missions: updatedMissions,
            completedMissionIds: [
              ...s.completedMissionIds,
              ...newlyCompleted.map((m) => m.id),
            ],
            sparks: s.sparks + sparkRewards,
          }
        }),

      purchaseUpgrade: (id, price) => {
        const s = get()
        if (s.sparks < price) return false
        const item = getCatalogItem(id)
        if (!item || item.scope === 'consumable') return false
        if (!canPurchaseUpgrade(id, s.purchasedUpgrades)) return false

        const withoutFamily =
          item.familyId != null
            ? s.purchasedUpgrades.filter((u) => {
                const existing = getCatalogItem(normalizeUpgradeId(u.id))
                return existing?.familyId !== item.familyId
              })
            : s.purchasedUpgrades.filter((u) => normalizeUpgradeId(u.id) !== id)

        set({
          sparks: s.sparks - price,
          purchasedUpgrades: [
            ...withoutFamily,
            { id, purchasedAt: new Date().toISOString() },
          ],
        })
        return true
      },

      purchaseLobbyRerollTicket: () => {
        const s = get()
        if (!s.runActive || !s.difficulty) return false
        const price = calcShopPrice(LOBBY_REROLL_TICKET.baseCost, s.difficulty)
        if (s.sparks < price) return false
        const existing = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        set({
          sparks: s.sparks - price,
          inventory: existing
            ? s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count + 1 } : i,
              )
            : [...s.inventory, { id: LOBBY_REROLL_TICKET_ID, count: 1 }],
        })
        return true
      },

      rerollLobbyGame: (slotIndex) => {
        const s = get()
        if (!s.runActive || !s.runSeed) return false
        const stack = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        if (!stack || stack.count <= 0) return false

        const nextGames = rerollLobbySlot(
          s.floorGames,
          slotIndex,
          SURVIVAL_GAME_POOL,
          s.runSeed,
          s.currentFloor,
          s.lobbyRerollCount,
        )
        if (!nextGames) return false

        const nextInventory =
          stack.count <= 1
            ? s.inventory.filter((i) => i.id !== LOBBY_REROLL_TICKET_ID)
            : s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count - 1 } : i,
              )

        set({
          floorGames: nextGames,
          inventory: nextInventory,
          lobbyRerollCount: s.lobbyRerollCount + 1,
        })
        return true
      },

      rerollShop: () => {
        const s = get()
        if (!s.runActive || !s.difficulty) return false
        const cost = calcShopRerollCost(s.shopRerollCount, s.difficulty)
        if (s.sparks < cost) return false
        set({ sparks: s.sparks - cost, shopRerollCount: s.shopRerollCount + 1 })
        return true
      },

      rerollMissions: () => {
        const s = get()
        if (!s.runActive || !s.runSeed || !s.difficulty) return false
        if (!canRerollMissions(s.missions)) return false
        const cost = calcMissionRerollCost(s.missionRerollCount, s.difficulty)
        if (s.sparks < cost) return false
        const nextCount = s.missionRerollCount + 1
        const missions = generateMissionsForFloor(
          s.runSeed,
          s.currentFloor,
          s.difficulty,
          s.floorGames,
          s.floorMinBet,
          nextCount,
        )
        set({
          sparks: s.sparks - cost,
          missionRerollCount: nextCount,
          missions,
        })
        return true
      },

      appendFloorHistory: (record: FloorRecord) =>
        set((s) => ({ floorHistory: [...s.floorHistory, record] })),

      recordResult: (result: GameResult) =>
        set((s) => {
          const newBankroll = s.bankroll - result.betAmount + result.payout
          return {
            gamesPlayed: s.gamesPlayed + 1,
            streak: result.outcome === 'win' ? s.streak + 1 : 0,
            jackpotMeter: Math.min(100, s.jackpotMeter + (result.game === 'slots' ? 5 : 1)),
            history: [...s.history, result],
            bankroll: newBankroll,
            peakBankroll: Math.max(s.peakBankroll, newBankroll),
          }
        }),

      recordResultPayout: (result: GameResult) =>
        set((s) => {
          const newBankroll = s.bankroll + result.payout
          const quotaMet = s.quotaMet || newBankroll >= s.quotaTarget

          const streak =
            result.outcome === 'win' ? s.streak + 1 : result.outcome === 'loss' ? 0 : s.streak

          return {
            gamesPlayed: s.gamesPlayed + 1,
            streak,
            jackpotMeter: Math.min(100, s.jackpotMeter + (result.game === 'slots' ? 5 : 1)),
            history: [...s.history, result],
            bankroll: newBankroll,
            peakBankroll: Math.max(s.peakBankroll, newBankroll),
            quotaMet,
          }
        }),

      deductBet: (amount: number) =>
        set((s) => ({ bankroll: s.bankroll - amount })),

      resetJackpotMeter: () => set({ jackpotMeter: 0 }),

      setCursed: (val: boolean) => set({ cursed: val }),
    }),
    {
      name: 'floored-survival',
      version: 4,
      migrate: (persistedState: unknown, fromVersion: number): unknown =>
        migratePersistedState(persistedState, fromVersion),
      partialize: (state) => {
        const partial: Record<string, unknown> = {}
        for (const key of RUN_PERSIST_KEYS) {
          partial[key] = state[key as keyof typeof state]
        }
        return partial
      },
    },
  ),
)
