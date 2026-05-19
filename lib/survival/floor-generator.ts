import { createRng, seedFromString } from '@/utils/rng'
import { getFloorMinBet } from '@/utils/math'
import { calcQuotaTarget, sparkFloorMult, MAX_FLOORS } from './balance'
import { generateMissionsForFloor } from './missions'
import type { GenerateFloorInput, GeneratedFloor } from './types'
import type { GameName } from '@/store/types'

const GAMES_PER_FLOOR = 6

function fisherYates(arr: GameName[], rng: () => number): GameName[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i] as GameName
    a[i] = a[j] as GameName
    a[j] = tmp
  }
  return a
}

/**
 * Generates game assignments for all MAX_FLOORS floors from the run seed.
 * Strategy: shuffle the pool in batches — each shuffle covers floor(pool/6)
 * floors, so every game appears in exactly one slot per shuffle.
 * Result: each game appears 3–4 times across 10 floors (never 0, never > 5).
 */
function generateRunSchedule(runSeed: string, pool: GameName[]): GameName[][] {
  const rng = createRng(seedFromString(`${runSeed}:schedule`))
  const floorsPerShuffle = Math.floor(pool.length / GAMES_PER_FLOOR)
  const schedule: GameName[][] = []

  while (schedule.length < MAX_FLOORS) {
    const shuffled = fisherYates(pool, rng)
    for (let f = 0; f < floorsPerShuffle && schedule.length < MAX_FLOORS; f++) {
      schedule.push(shuffled.slice(f * GAMES_PER_FLOOR, (f + 1) * GAMES_PER_FLOOR) as GameName[])
    }
  }

  return schedule
}

/**
 * Pure, seeded floor generator. Given the same runSeed + floor number, always
 * produces the same result. No React or Zustand imports.
 */
export function generateFloor(input: GenerateFloorInput): GeneratedFloor {
  const { runSeed, floor, difficulty, survivalGamePool } = input

  let floorGames: GameName[]
  if (floor <= MAX_FLOORS) {
    const schedule = generateRunSchedule(runSeed, survivalGamePool)
    floorGames = schedule[floor - 1] ?? (schedule[0] as GameName[])
  } else {
    const rng = createRng(seedFromString(`${runSeed}:endless:${floor}`))
    floorGames = fisherYates(survivalGamePool, rng).slice(0, GAMES_PER_FLOOR) as GameName[]
  }

  return {
    quotaTarget: calcQuotaTarget(floor, difficulty),
    floorGames,
    missions: generateMissionsForFloor(runSeed, floor, difficulty, floorGames, getFloorMinBet(floor)),
    rewardScaling: { sparkFloorMult: sparkFloorMult(floor) },
  }
}
