import type { PlinkoOutcome } from './types'

export const PLINKO_ROWS = 10
export const PLINKO_SLOT_COUNT = 11

export const PLINKO_MULTIPLIERS = [
  10, 5, 2, 1.2, 0.5, 0.2, 0.5, 1.2, 2, 5, 10,
] as const

const CENTER = 5

/**
 * Fair Galton path: each row is an independent 50/50 “right” Bernoulli trial.
 * After t trials, net steps right − left = 2*rights − t, so slot = center + that.
 * We only clamp to [0, 10] for the **display** coordinate each step — unlike
 * clamping the *walk* at every step, this yields a true Binomial(10, ½) endpoint
 * (peaked at the middle); per-step clamping at the walls was inflating 10×/5×.
 */
function generateSinglePlinkoPath(): number[] {
  const path: number[] = []
  let rights = 0
  path.push(clampSlot(CENTER + 2 * rights - 0))
  for (let t = 1; t <= PLINKO_ROWS; t += 1) {
    if (Math.random() < 0.5) rights += 1
    path.push(clampSlot(CENTER + 2 * rights - t))
  }
  return path
}

function clampSlot(slot: number): number {
  return Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, slot))
}

/** One path per ball: 11 horizontal slot indices (start at center + 10 steps). */
export function generatePlinkoPath(ballCount: number): number[][] {
  const paths: number[][] = []
  for (let b = 0; b < ballCount; b += 1) {
    paths.push(generateSinglePlinkoPath())
  }
  return paths
}

export function getSlotMultipliers(): readonly number[] {
  return PLINKO_MULTIPLIERS
}

export interface PlinkoPayoutResult {
  totalPayout: number
  outcome: PlinkoOutcome
  /** totalPayout / betAmount (0 if bet is 0). */
  effectiveMultiplier: number
}

/** Per ball: round((Bet / ballCount) * multiplier[finalSlot]). */
export function computePlinkoPayout(betAmount: number, ballCount: number, paths: number[][]): PlinkoPayoutResult {
  if (ballCount <= 0 || paths.length === 0) {
    return { totalPayout: 0, outcome: 'loss', effectiveMultiplier: 0 }
  }
  const stake = betAmount / ballCount
  let total = 0
  for (const path of paths) {
    const finalSlot = path[path.length - 1] ?? 0
    const mult = PLINKO_MULTIPLIERS[finalSlot] ?? 0
    total += Math.round(stake * mult)
  }
  let outcome: PlinkoOutcome
  if (total > betAmount) outcome = 'win'
  else if (total === betAmount) outcome = 'push'
  else outcome = 'loss'

  const effectiveMultiplier = betAmount > 0 ? total / betAmount : 0
  return { totalPayout: total, outcome, effectiveMultiplier }
}
