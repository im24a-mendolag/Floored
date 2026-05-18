import { createRng, seedFromString } from '@/utils/rng'
import { calcQuotaTarget, sparkFloorMult } from './balance'
import type { GenerateFloorInput, GeneratedFloor } from './types'
import type { GameName } from '@/store/types'

/**
 * Pure, seeded floor generator. Given the same runSeed + floor number, always
 * produces the same result. No React or Zustand imports.
 */
export function generateFloor(input: GenerateFloorInput): GeneratedFloor {
  const { runSeed, floor, difficulty, survivalGamePool } = input
  const rng = createRng(seedFromString(`${runSeed}:floor:${floor}`))

  // Fisher-Yates shuffle of the pool using the seeded RNG.
  const pool: GameName[] = [...survivalGamePool]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i] as GameName
    pool[i] = pool[j] as GameName
    pool[j] = tmp
  }

  // Take 6 unique games. If pool < 6, cycle to fill (temporary — once Step 13
  // ships all survival routes the pool will have 10+ games and this won't fire).
  const needed = 6
  const floorGames: GameName[] =
    pool.length >= needed
      ? pool.slice(0, needed)
      : Array.from({ length: needed }, (_, i) => pool[i % pool.length] as GameName)

  return {
    quotaTarget: calcQuotaTarget(floor, difficulty),
    floorGames,
    missions: [], // populated in Step 8
    rewardScaling: { sparkFloorMult: sparkFloorMult(floor) },
  }
}
