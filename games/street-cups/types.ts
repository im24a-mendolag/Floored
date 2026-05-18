export type StreetCupsStage = 'betting' | 'revealing' | 'shuffling' | 'picking' | 'settled'

export interface CupSwap {
  /** Visual slot indices (0=left, 1=center, 2=right) to exchange. */
  a: number
  b: number
}

export interface StreetCupsState {
  betAmount: number
  stage: StreetCupsStage
  /** Visual slot that briefly shows the crown before shuffling. */
  revealSlot: number | null
  /** Sequence of visual-slot swaps to animate during the shuffle. */
  shuffleSwaps: CupSwap[]
  /** Visual slot holding the prize after shuffle — set only after shuffle ends. */
  winningSlot: number | null
  playerPick: number | null
  outcome: 'win' | 'loss' | null
  message: string
}
