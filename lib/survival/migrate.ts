import type { Difficulty } from '@/store/types'
import { SURVIVAL_GAME_POOL, calcQuotaTarget } from './balance'
import { generateFloor } from './floor-generator'

/**
 * Zustand persist migration callback for the floored-survival key.
 * Called when the stored version < current version (1).
 *
 * v0 → v1: adds quota, floorGames, and stub arrays while preserving all
 * existing bankroll/run fields. Does not wipe runActive or bankroll.
 */
export function migratePersistedState(raw: unknown, fromVersion: number): unknown {
  if (fromVersion >= 1) return raw

  const s =
    raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const floor = typeof s.currentFloor === 'number' ? s.currentFloor : 1
  const difficulty = (s.difficulty as Difficulty | null) ?? null
  const runSeed = typeof s.runSeed === 'string' ? s.runSeed : null

  // Default quota + games in case generation fails.
  let quotaTarget = calcQuotaTarget(floor, difficulty ?? 'normal')
  let floorGames = SURVIVAL_GAME_POOL.slice(0, 6)

  if (runSeed && difficulty) {
    try {
      const generated = generateFloor({
        runSeed,
        floor,
        difficulty,
        survivalGamePool: SURVIVAL_GAME_POOL,
      })
      quotaTarget = generated.quotaTarget
      floorGames = generated.floorGames
    } catch {
      // fall through to defaults computed above
    }
  }

  return {
    ...s,
    version: 1,
    quotaTarget,
    quotaProgress: 0,
    floorGames,
    missions: [],
    completedMissionIds: [],
    purchasedUpgrades: [],
    inventory: [],
    floorHistory: [],
  }
}
