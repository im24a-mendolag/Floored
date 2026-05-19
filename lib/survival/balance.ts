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
  'mines',
  'chicken-road',
  'slots',
  'roulette',
  'dragon-tower',
  'chicken-race',
  'street-cups',
  'case-battles',
  'poker-1p',
  'hilo',
  'keno',
  'coin-flip',
]

const DIFFICULTY_MULT: Record<Difficulty, number> = {
  normal: 1.0,
  hard: 1.5,
  nightmare: 2.5,
}

/**
 * Absolute bankroll goal for a given floor.
 * Floor 1 = $2,000  |  Floor 10 = $1,000,000  |  endless scaling beyond.
 * Formula: 2000 * 500^((floor-1)/9)
 */
export function calcQuotaTarget(floor: number, difficulty: Difficulty): number {
  const base = Math.round(2_000 * Math.pow(500, (floor - 1) / 9))
  return Math.round(base * DIFFICULTY_MULT[difficulty])
}

/**
 * Spark reward multiplier per floor (used in Step 7).
 * Linear: floor 1 = 1.0×, floor 10 = 2.8×.
 */
export function sparkFloorMult(floor: number): number {
  return 1 + (floor - 1) * 0.2
}
