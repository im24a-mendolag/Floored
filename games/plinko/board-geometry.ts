/**
 * Large viewBox so the board reads at Blackjack/Crash scale on desktop.
 * Ratio kept similar to the original 300×240 (5:4).
 */
export const VIEWBOX_WIDTH = 560
export const VIEWBOX_HEIGHT = 448
export const BOARD_MARGIN = 40
export const SLOT_COUNT = 11
export const PIN_ROWS = 10

const innerWidth = VIEWBOX_WIDTH - 2 * BOARD_MARGIN
export const SLOT_WIDTH = innerWidth / SLOT_COUNT

/** Row band height (12 rows across full view height). */
export const ROW_BAND = VIEWBOX_HEIGHT / 12

export function getBallX(_stepIndex: number, slotIndex: number): number {
  return BOARD_MARGIN + (slotIndex + 0.5) * SLOT_WIDTH
}

export function getBallY(stepIndex: number): number {
  return stepIndex * ROW_BAND
}

export function getBallCenterY(stepIndex: number): number {
  return getBallY(stepIndex) + ROW_BAND / 2
}

/** Triangular pin grid: row 0 has 1 pin, row 9 has 10; pins sit between slot columns. */
export function getPinX(row: number, col: number): number {
  return BOARD_MARGIN + (col + (PIN_ROWS - row) / 2) * SLOT_WIDTH
}

export function getPinY(row: number): number {
  return (row + 0.5) * ROW_BAND
}

export function slotRectX(slotIndex: number): number {
  return BOARD_MARGIN + slotIndex * SLOT_WIDTH
}

export const SLOT_ROW_TOP = 10 * ROW_BAND

/** Full strip below the last pin row (was 2 row-bands). */
const SLOT_ZONE_FULL = VIEWBOX_HEIGHT - SLOT_ROW_TOP

/** Multiplier tray: half the previous height, flush to bottom of viewBox. */
export const SLOT_BAND_HEIGHT = SLOT_ZONE_FULL / 2
export const SLOT_RECT_Y = VIEWBOX_HEIGHT - SLOT_BAND_HEIGHT
