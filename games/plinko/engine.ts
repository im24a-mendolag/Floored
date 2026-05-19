import type { PlinkoPath, PlinkoPayoutResult, PlinkoRisk } from './types'

export const ROWS = 16
export const SLOT_COUNT = ROWS + 1 // 17 slots, indexed 0..ROWS

/**
 * Slot multipliers per risk level, symmetric left-to-right.
 * Index 0 = far-left edge, index ROWS = far-right edge.
 *
 * All values verified against exact binomial counts C(16,k) / 2^16:
 *   low    → E ≈ 0.963  (~96% RTP) — no zeros, narrow swings
 *   medium → E ≈ 0.949  (~95% RTP) — default
 *   high   → E ≈ 0.945  (~94% RTP) — center slot pays 0×, bigger edges
 */
const MULTIPLIERS: Record<PlinkoRisk, readonly number[]> = {
  low:    [25,  10,  5,  3, 2, 1.5, 1.1, 0.6, 0.5, 0.6, 1.1, 1.5, 2, 3,  5,  10,  25],
  medium: [75,  19,  7,  4, 2, 1.5, 1,   0.6, 0.4, 0.6, 1,   1.5, 2, 4,  7,  19,  75],
  high:   [200, 50, 15,  6, 2.5, 1.5, 1, 0.5, 0,   0.5, 1,   1.5, 2.5, 6, 15, 50, 200],
}

export function getSlotMultipliers(risk: PlinkoRisk = 'medium'): readonly number[] {
  return MULTIPLIERS[risk]
}

/**
 * Generate one ball's path through the board.
 *
 * Each row has one independent coin flip. The ball's column at row r is the
 * running count of right decisions through rows 0..r-1, making it trivial to
 * derive the exact (row, col) position for any animation frame.
 */
export function generatePath(): PlinkoPath {
  const decisions = Array.from({ length: ROWS }, () => Math.random() < 0.5)
  const slotIndex = decisions.reduce((n, right) => n + (right ? 1 : 0), 0)
  return { decisions, slotIndex }
}

/**
 * Resolve a path into a payout.
 * Payout is rounded to the nearest whole chip.
 */
export function computePayout(betAmount: number, path: PlinkoPath, risk: PlinkoRisk = 'medium'): PlinkoPayoutResult {
  const multiplier = MULTIPLIERS[risk][path.slotIndex] ?? 0
  const payout = Math.round(betAmount * multiplier)
  const outcome = payout >= betAmount ? 'win' : 'loss'
  return { multiplier, payout, outcome }
}

/**
 * Derive the ball's column within a given row from the decisions array.
 * Column at row r = number of right decisions through rows 0..r-1.
 * Safe to call for any r in [0, ROWS].
 */
export function ballColAtRow(decisions: boolean[], row: number): number {
  let col = 0
  for (let r = 0; r < row; r++) col += decisions[r] ? 1 : 0
  return col
}
