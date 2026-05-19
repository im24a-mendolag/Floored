import { ROWS } from './engine'

export const VIEWBOX_WIDTH = 440

export const PIN_R = 4
export const BALL_R = 7

const VIEW_CX = VIEWBOX_WIDTH / 2  // 220
const BOARD_TOP = 20               // y of row-0 pin
const ROW_HEIGHT = 25              // vertical gap between rows
const PIN_SPACING = 24             // horizontal gap between adjacent pins in the same row

// The slot band sits just below the "virtual" row ROWS
export const SLOT_BAND_TOP = BOARD_TOP + ROWS * ROW_HEIGHT + 10
export const SLOT_HEIGHT = 36
export const SLOT_WIDTH = PIN_SPACING  // one slot per inter-pin column

export const VIEWBOX_HEIGHT = SLOT_BAND_TOP + SLOT_HEIGHT + 14

/**
 * X center of the pin at (row, col).
 * Works for row 0..ROWS — row ROWS is the virtual landing row whose
 * positions coincide with slot centers.
 */
export function pinX(row: number, col: number): number {
  return VIEW_CX + (col - row / 2) * PIN_SPACING
}

/** Y center of the pin at row. Works for row 0..ROWS. */
export function pinY(row: number): number {
  return BOARD_TOP + row * ROW_HEIGHT
}

/** X center of slot k (0 = far-left, ROWS = far-right). */
export function slotCenterX(k: number): number {
  // Equivalent to pinX(ROWS, k) — slots align with the virtual row
  return VIEW_CX + (k - ROWS / 2) * PIN_SPACING
}

/** Left edge X of slot k. */
export function slotLeft(k: number): number {
  return slotCenterX(k) - SLOT_WIDTH / 2
}
