export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  rank: Rank
}

export type PokerHandRank =
  | 'royal-flush'
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'jacks-or-better'
  | 'none'

export type PokerStage = 'betting' | 'selecting' | 'settled'

export interface PokerState {
  stage: PokerStage
  betAmount: number
  hand: Card[]
  held: boolean[]
  handRank: PokerHandRank
  multiplier: number
  winningIndices: number[]
  outcome: 'win' | 'loss' | null
  message: string
}
