import { createRng, seedFromString } from '@/utils/rng'
import type { Difficulty, FloorMission, GameName } from '@/store/types'

export type MissionType =
  | 'win_streak'
  | 'play_game'
  | 'min_multiplier'
  | 'games_played'
  | 'flawless'

/** All mission templates that can appear on a floor (1–2 picked at random per floor). */
export const MISSION_DEFINITIONS: Array<{
  type: MissionType
  target: number
  baseReward: number
  description: string
}> = [
  {
    type: 'win_streak',
    target: 2,
    baseReward: 3,
    description: 'Win 2 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'win_streak',
    target: 3,
    baseReward: 4,
    description: 'Win 3 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'win_streak',
    target: 4,
    baseReward: 5,
    description: 'Win 4 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'win_streak',
    target: 5,
    baseReward: 6,
    description: 'Win 5 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'play_game',
    target: 1,
    baseReward: 3,
    description: 'Play a specific floor lobby game once at the floor minimum bet or higher.',
  },
  {
    type: 'min_multiplier',
    target: 2,
    baseReward: 4,
    description: 'Win a round with a 2× or higher payout multiplier.',
  },
  {
    type: 'games_played',
    target: 4,
    baseReward: 4,
    description: 'Play 4 separate rounds on this floor.',
  },
  {
    type: 'flawless',
    target: 1,
    baseReward: 5,
    description: 'Complete the floor without losing a single bet.',
  },
]

const MISSION_POOL: Array<{
  type: MissionType
  target: number
  baseReward: number
}> = MISSION_DEFINITIONS.map(({ type, target, baseReward }) => ({ type, target, baseReward }))

function rewardForFloor(base: number, floor: number, difficulty: Difficulty): number {
  const mult = difficulty === 'nightmare' ? 1.4 : difficulty === 'hard' ? 1.2 : 1
  return Math.max(1, Math.floor(base * (1 + (floor - 1) * 0.1) * mult))
}

function removePickedFromPool(
  pool: typeof MISSION_POOL,
  picked: (typeof MISSION_POOL)[number],
): typeof MISSION_POOL {
  if (picked.type === 'win_streak') {
    return pool.filter((p) => p.type !== 'win_streak')
  }
  return pool.filter((p) => p.type !== picked.type || p.target !== picked.target)
}

/**
 * Seeded 1–2 missions per floor.
 */
export function generateMissionsForFloor(
  runSeed: string,
  floor: number,
  difficulty: Difficulty,
  floorGames: GameName[],
  floorMinBet: number,
  rerollCount = 0,
): FloorMission[] {
  const rng = createRng(seedFromString(`${runSeed}:missions:${floor}:${rerollCount}`))
  const count = rng() < 0.45 ? 1 : 2
  let pool = [...MISSION_POOL]
  const picked: FloorMission[] = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length)
    const def = pool[idx]!
    pool = removePickedFromPool(pool, def)
    const game =
      def.type === 'play_game'
        ? floorGames[Math.floor(rng() * floorGames.length)]
        : undefined
    picked.push({
      id: `${floor}-${def.type}-${def.target}-${i}-${game ?? 'any'}`,
      type: def.type,
      target: def.target,
      progress: 0,
      rewardSparks: rewardForFloor(def.baseReward, floor, difficulty),
      completed: false,
      ...(game ? { game } : {}),
      ...(def.type === 'play_game' ? { minBet: floorMinBet } : {}),
    })
  }

  return picked
}
