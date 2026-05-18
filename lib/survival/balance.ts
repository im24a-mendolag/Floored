import type { Difficulty, GameName } from '@/store/types'

export const MAX_FLOORS = 10

/**
 * Games with an existing app/survival/<game>/page.tsx route.
 * Deliberately NOT gated by availableSurvival flag in lobby.tsx — that flag
 * controls what the lobby shows, not what the generator can pick from.
 * Step 13 will flip the lobby flags; this pool is already complete.
 */
export const SURVIVAL_GAME_POOL: GameName[] = [
  'blackjack',
  'crash',
  'plinko',
  'over-under',
  'wheel',
  'run-dice',
  'chicken-road',
  'slots',
  'roulette',
  'mines',
]

/**
 * Base quota = net-profit chips the player must earn this floor.
 * Formula: 100 × 1.5^(floor-1), capped at MAX_FLOORS for param lookup.
 * Floor 1: 100 | Floor 3: 225 | Floor 5: 506 | Floor 10: 3,844
 */
function baseQuota(floor: number): number {
  const f = Math.min(floor, MAX_FLOORS)
  return Math.floor(100 * Math.pow(1.5, f - 1))
}

const DIFFICULTY_MULT: Record<Difficulty, number> = {
  normal: 1.0,
  hard: 1.4,
  nightmare: 2.0,
}

/** Chips of net profit required to clear the floor. */
export function calcQuotaTarget(floor: number, difficulty: Difficulty): number {
  return Math.floor(baseQuota(floor) * DIFFICULTY_MULT[difficulty])
}

/**
 * Spark reward multiplier per floor (used in Step 7).
 * Linear: floor 1 = 1.0×, floor 10 = 2.8×.
 */
export function sparkFloorMult(floor: number): number {
  return 1 + (floor - 1) * 0.2
}
