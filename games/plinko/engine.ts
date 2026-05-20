import type { PlinkoPath, PlinkoPayoutResult, PlinkoRisk } from './types'

export const ROWS = 12
export const SLOT_COUNT = ROWS + 1 // 13 slots, indexed 0..ROWS

/**
 * Slot multipliers per risk level, symmetric left-to-right (13 values for 12 rows).
 * Index 0 = far-left edge, index ROWS = far-right edge.
 *
 * Binomial counts C(12,k) / 2^12:
 *   low    → E ≈ 0.961  (~96% RTP) — no zeros, narrow swings
 *   medium → E ≈ 0.955  (~96% RTP) — default
 *   high   → E ≈ 0.948  (~95% RTP) — center slot pays 0×, bigger edges
 */
const MULTIPLIERS: Record<PlinkoRisk, readonly number[]> = {
  low:    [4,   2,   1.5, 1.2, 1.0, 0.9, 0.8, 0.9, 1.0, 1.2, 1.5,  2,   4],
  medium: [8,   5,   3,   1.5, 1.0, 0.8, 0.5, 0.8, 1.0, 1.5,  3,   5,   8],
  high:   [100, 15,  5,   2,   1.0, 0.5,  0,  0.5, 1.0,  2,   5,  15, 100],
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
 * Blessed path: forces the ball into a winning slot (multiplier >= 1).
 * Picks randomly from all winning slots; decisions are shuffled so the
 * trajectory looks organic.
 */
export function winGamePath(risk: PlinkoRisk = 'medium'): PlinkoPath {
  const mults = MULTIPLIERS[risk]
  const winningSlots = mults.map((m, i) => (m >= 1 ? i : -1)).filter((i) => i >= 0)
  const slotIndex = winningSlots.length > 0
    ? winningSlots[Math.floor(Math.random() * winningSlots.length)]!
    : Math.floor(ROWS / 2)

  const decisions = Array.from({ length: ROWS }, (_, i) => i < slotIndex)
  for (let i = decisions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[decisions[i], decisions[j]] = [decisions[j]!, decisions[i]!]
  }
  return { decisions, slotIndex }
}

/**
 * Cursed path: forces the ball into a losing slot (multiplier < 1).
 * Picks randomly from all losing slots so the trajectory looks natural —
 * the decisions are shuffled so the ball bounces realistically to the target.
 */
export function loseGamePath(risk: PlinkoRisk = 'medium'): PlinkoPath {
  const mults = MULTIPLIERS[risk]
  const losingSlots = mults.map((m, i) => (m < 1 ? i : -1)).filter((i) => i >= 0)
  const slotIndex = losingSlots.length > 0
    ? losingSlots[Math.floor(Math.random() * losingSlots.length)]!
    : Math.floor(ROWS / 2)

  // Build exactly `slotIndex` right decisions and shuffle them so the visual
  // path looks organic even though the landing slot is predetermined.
  const decisions = Array.from({ length: ROWS }, (_, i) => i < slotIndex)
  for (let i = decisions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[decisions[i], decisions[j]] = [decisions[j]!, decisions[i]!]
  }
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
