export type KenoOutcome = 'win' | 'loss'

export type KenoStage = 'betting' | 'drawing' | 'settled'

export interface KenoState {
  stage: KenoStage
  betAmount: number
  /** Player-selected numbers (1–BOARD_SIZE). */
  picks: number[]
  /** Full draw sequence (length DRAW_COUNT), hidden until revealed. */
  drawn: number[]
  /** Drawn numbers revealed so far (for animation). */
  revealedDrawn: number[]
  hits: number
  multiplier: number
  outcome: KenoOutcome | null
  message: string
}
