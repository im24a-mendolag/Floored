import { createRng, seedFromString } from '@/utils/rng'
import type { Difficulty, FloorMission, GameName } from '@/store/types'

export type MissionType =
  | 'win_streak'
  | 'play_game'
  | 'min_multiplier'
  | 'games_played'
  | 'flawless'
  | 'win_count'
  | 'big_win'

/** All mission templates that can appear on a floor (3 picked at random per floor). */
export const MISSION_DEFINITIONS: Array<{
  type: MissionType
  target: number
  baseReward: number
  description: string
}> = [
  // win_streak — only one variant will appear per floor
  {
    type: 'win_streak',
    target: 2,
    baseReward: 4,
    description: 'Win 2 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'win_streak',
    target: 3,
    baseReward: 6,
    description: 'Win 3 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'win_streak',
    target: 4,
    baseReward: 8,
    description: 'Win 4 rounds in a row on this floor (a loss resets progress).',
  },
  {
    type: 'win_streak',
    target: 5,
    baseReward: 10,
    description: 'Win 5 rounds in a row on this floor (a loss resets progress).',
  },
  // play_game
  {
    type: 'play_game',
    target: 1,
    baseReward: 5,
    description: 'Play a specific floor lobby game once at the floor minimum bet or higher.',
  },
  // min_multiplier
  {
    type: 'min_multiplier',
    target: 2,
    baseReward: 5,
    description: 'Win a round with a 2× or higher payout multiplier.',
  },
  {
    type: 'min_multiplier',
    target: 3,
    baseReward: 8,
    description: 'Win a round with a 3× or higher payout multiplier.',
  },
  // games_played
  {
    type: 'games_played',
    target: 4,
    baseReward: 4,
    description: 'Play 4 separate rounds on this floor.',
  },
  {
    type: 'games_played',
    target: 6,
    baseReward: 6,
    description: 'Play 6 separate rounds on this floor.',
  },
  // flawless
  {
    type: 'flawless',
    target: 1,
    baseReward: 8,
    description: 'Complete the floor without losing a single bet.',
  },
  // win_count — total wins this floor (losses OK)
  {
    type: 'win_count',
    target: 2,
    baseReward: 4,
    description: 'Win 2 rounds on this floor (losses are fine).',
  },
  {
    type: 'win_count',
    target: 4,
    baseReward: 6,
    description: 'Win 4 rounds on this floor (losses are fine).',
  },
  // big_win — net profit in a single round, target is a minBet multiplier (resolved at floor gen time)
  {
    type: 'big_win',
    target: 10,
    baseReward: 5,
    description: 'Net at least 10× the floor minimum bet in a single round.',
  },
  {
    type: 'big_win',
    target: 30,
    baseReward: 8,
    description: 'Net at least 30× the floor minimum bet in a single round.',
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

// Types with multiple variants — once one is picked, all variants are excluded.
const EXCLUSIVE_TYPES: MissionType[] = ['win_streak', 'min_multiplier', 'games_played', 'win_count', 'big_win']

function removePickedFromPool(
  pool: typeof MISSION_POOL,
  picked: (typeof MISSION_POOL)[number],
): typeof MISSION_POOL {
  if ((EXCLUSIVE_TYPES as string[]).includes(picked.type)) {
    return pool.filter((p) => p.type !== picked.type)
  }
  return pool.filter((p) => p.type !== picked.type || p.target !== picked.target)
}

/** Seeded mission count per floor. */
export const MISSIONS_PER_FLOOR = 3

export function generateMissionsForFloor(
  runSeed: string,
  floor: number,
  difficulty: Difficulty,
  floorGames: GameName[],
  floorMinBet: number,
  rerollCount = 0,
  excludeAtIndex?: { index: number; type: MissionType; target: number },
): FloorMission[] {
  const rng = createRng(seedFromString(`${runSeed}:missions:${floor}:${rerollCount}`))
  const count = MISSIONS_PER_FLOOR
  let pool = [...MISSION_POOL]
  const picked: FloorMission[] = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    let slotPool = pool
    if (excludeAtIndex && i === excludeAtIndex.index) {
      const filtered = pool.filter(
        (p) => !(p.type === excludeAtIndex.type && p.target === excludeAtIndex.target),
      )
      if (filtered.length > 0) slotPool = filtered
    }
    const idx = Math.floor(rng() * slotPool.length)
    const def = slotPool[idx]!
    pool = removePickedFromPool(pool, def)
    const game =
      def.type === 'play_game'
        ? floorGames[Math.floor(rng() * floorGames.length)]
        : undefined
    // big_win target is stored as a minBet multiplier — resolve to actual chips at gen time
    const target = def.type === 'big_win' ? def.target * floorMinBet : def.target
    picked.push({
      id: `${floor}-${def.type}-${target}-${i}-${game ?? 'any'}`,
      type: def.type,
      target,
      progress: 0,
      rewardSparks: rewardForFloor(def.baseReward, floor, difficulty),
      completed: false,
      minBet: floorMinBet,
      ...(game ? { game } : {}),
    })
  }

  return picked
}

export function missionOfferKey(m: Pick<FloorMission, 'type' | 'target' | 'game'>): string {
  return `${m.type}:${m.target}:${m.game ?? ''}`
}

export function missionOfferedKeysFromMissions(missions: FloorMission[]): string[] {
  return [...new Set(missions.map(missionOfferKey))]
}

function resolvedTarget(
  def: (typeof MISSION_POOL)[number],
  floorMinBet: number,
): number {
  return def.type === 'big_win' ? def.target * floorMinBet : def.target
}

function isMissionDefAlreadyOffered(
  def: (typeof MISSION_POOL)[number],
  offeredKeys: Set<string>,
  floorMinBet: number,
): boolean {
  if ((EXCLUSIVE_TYPES as string[]).includes(def.type)) {
    return [...offeredKeys].some((k) => k.startsWith(`${def.type}:`))
  }
  const target = resolvedTarget(def, floorMinBet)
  return offeredKeys.has(`${def.type}:${target}:`)
}

function buildMissionFromDef(
  def: (typeof MISSION_POOL)[number],
  floor: number,
  slotIndex: number,
  difficulty: Difficulty,
  floorGames: GameName[],
  floorMinBet: number,
  game: GameName | undefined,
): FloorMission {
  const target = resolvedTarget(def, floorMinBet)
  return {
    id: `${floor}-${def.type}-${target}-${slotIndex}-${game ?? 'any'}`,
    type: def.type,
    target,
    progress: 0,
    rewardSparks: rewardForFloor(def.baseReward, floor, difficulty),
    completed: false,
    minBet: floorMinBet,
    ...(game ? { game } : {}),
  }
}

/** Pick a replacement mission for one slot (not in offeredKeys). */
export function pickMissionRerollForSlot(input: {
  runSeed: string
  floor: number
  slotIndex: number
  rollSeq: number
  difficulty: Difficulty
  floorGames: GameName[]
  floorMinBet: number
  offeredKeys: string[]
}): FloorMission | null {
  const offered = new Set(input.offeredKeys)
  const candidates = MISSION_POOL.filter(
    (def) => !isMissionDefAlreadyOffered(def, offered, input.floorMinBet),
  )
  if (candidates.length === 0) return null

  const rng = createRng(
    seedFromString(
      `${input.runSeed}:mission-ticket:${input.floor}:${input.slotIndex}:${input.rollSeq}`,
    ),
  )
  const def = candidates[Math.floor(rng() * candidates.length)]!
  const game =
    def.type === 'play_game'
      ? input.floorGames[Math.floor(rng() * input.floorGames.length)]
      : undefined
  return buildMissionFromDef(
    def,
    input.floor,
    input.slotIndex,
    input.difficulty,
    input.floorGames,
    input.floorMinBet,
    game,
  )
}
