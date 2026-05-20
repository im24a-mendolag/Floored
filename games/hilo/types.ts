export type HiLoStage = 'betting' | 'playing' | 'riding' | 'settled'

export interface HiLoCard {
  suit: '♠' | '♥' | '♦' | '♣'
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
  value: number
}

export interface HiLoState {
  deck: HiLoCard[]
  currentCard: HiLoCard | null
  nextCard: HiLoCard | null
  betAmount: number
  stage: HiLoStage
  outcome: 'win' | 'loss' | null
  lastGuess: 'higher' | 'lower' | null
  /** Consecutive correct guesses in this round. */
  streak: number
  /** Current cash-out multiplier based on streak. */
  multiplier: number
  /** True when the last card was a tie (push). */
  isTie: boolean
  message: string
}
