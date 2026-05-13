import { PLINKO_ROWS, PLINKO_SLOT_COUNT } from './engine'

export const VIEWBOX_WIDTH = 560
export const VIEWBOX_HEIGHT = 600
export const BOARD_MARGIN = 28

const innerWidth = VIEWBOX_WIDTH - 2 * BOARD_MARGIN
export const SLOT_WIDTH = innerWidth / PLINKO_SLOT_COUNT

/** Row band height: 14 pin rows + 2 reserved rows for the slot tray. */
export const ROW_BAND = VIEWBOX_HEIGHT / (PLINKO_ROWS + 2)

export function getBallX(_stepIndex: number, slotIndex: number): number {
  return BOARD_MARGIN + (slotIndex + 0.5) * SLOT_WIDTH
}

export function getBallY(stepIndex: number): number {
  return stepIndex * ROW_BAND
}

export function getBallCenterY(stepIndex: number): number {
  return getBallY(stepIndex) + ROW_BAND / 2
}

/** Triangular pin grid: row 0 has 1 pin, row 9 has 10 pins; pins sit at slot boundaries. */
export function getPinX(row: number, col: number): number {
  return BOARD_MARGIN + (col + (PLINKO_ROWS - row) / 2 + 0.5) * SLOT_WIDTH
}

export function getPinY(row: number): number {
  return (row + 0.5) * ROW_BAND
}

export function slotRectX(slotIndex: number): number {
  return BOARD_MARGIN + slotIndex * SLOT_WIDTH
}

export const SLOT_ROW_TOP = PLINKO_ROWS * ROW_BAND

/** Gap between the last pin row and the top of the multiplier tray. */
const SLOT_GAP_ABOVE = 12
/** Gap between the bottom of the multiplier tray and the viewBox edge. */
const SLOT_GAP_BELOW = 34

export const SLOT_BAND_HEIGHT = VIEWBOX_HEIGHT - SLOT_ROW_TOP - SLOT_GAP_ABOVE - SLOT_GAP_BELOW
export const SLOT_RECT_Y = SLOT_ROW_TOP + SLOT_GAP_ABOVE
