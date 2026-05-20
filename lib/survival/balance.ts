import type { Difficulty, GameName } from '@/store/types'

/** Dev/testing: grant every shop upgrade when a survival run starts. Set false before release. */
export const GRANT_ALL_UPGRADES = false

/** Dev/testing: bankroll and sparks when a survival run starts (and idle reset). */
export const STARTING_BANKROLL = 1000
export const STARTING_SPARKS = 15

/** Dev/testing: starting reroll tickets granted in inventory for a run */
export const STARTING_REROLL_TICKETS = 3
/** How many reroll tickets are awarded automatically when advancing to the next floor */
export const REROLL_TICKETS_PER_FLOOR = 3

export const MAX_FLOORS = 10
export const FLOOR_BET_LIMIT = 10

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

export const DIFFICULTY_QUOTA_MULT: Record<Difficulty, number> = {
  normal: 1.0,
  hard: 1.5,
  nightmare: 2.5,
}

/**
 * Multiplier on shop upgrade/consumable prices (see calcShopPrice).
 * Harder runs demand more sparks per purchase.
 */
export const DIFFICULTY_SHOP_PRICE_MULT: Record<Difficulty, number> = {
  normal: 1.0,
  hard: 1.5,
  nightmare: 2.0,
}

/**
 * Absolute bankroll goal for a given floor.
 * Floor 1 = $2,000  |  Floor 10 = $1,000,000  |  endless scaling beyond.
 * Formula: 2000 * 500^((floor-1)/9)
 */
export function calcQuotaTarget(floor: number, difficulty: Difficulty): number {
  const base = Math.round(2_000 * Math.pow(500, (floor - 1) / 9))
  return Math.round(base * DIFFICULTY_QUOTA_MULT[difficulty])
}

/** Sparks cost for a catalog item after difficulty scaling. */
export function calcShopPrice(baseCost: number, difficulty: Difficulty): number {
  return Math.ceil(baseCost * DIFFICULTY_SHOP_PRICE_MULT[difficulty])
}

/** Base + step × rerolls already used this floor, scaled by difficulty. */
export function calcRerollCost(
  base: number,
  step: number,
  rerollsUsed: number,
  difficulty: Difficulty,
): number {
  return Math.ceil((base + step * rerollsUsed) * DIFFICULTY_SHOP_PRICE_MULT[difficulty])
}

export const SHOP_REROLL_BASE = 5
export const SHOP_REROLL_STEP = 4
export const MISSION_REROLL_BASE = 4
export const MISSION_REROLL_STEP = 3

export function calcShopRerollCost(rerollsUsed: number, difficulty: Difficulty): number {
  return calcRerollCost(SHOP_REROLL_BASE, SHOP_REROLL_STEP, rerollsUsed, difficulty)
}

export function calcMissionRerollCost(rerollsUsed: number, difficulty: Difficulty): number {
  return calcRerollCost(MISSION_REROLL_BASE, MISSION_REROLL_STEP, rerollsUsed, difficulty)
}

/**
 * Spark reward multiplier per floor (used in Step 7).
 * Linear: floor 1 = 1.0×, floor 10 = 2.8×.
 */
export function sparkFloorMult(floor: number): number {
  return 1 + (floor - 1) * 0.2
}
