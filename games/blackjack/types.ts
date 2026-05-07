export interface GameEngine<TState, TConfig> {
  init: (config: TConfig) => TState
  start: (betAmount: number, state: TState) => TState
  resolve: (outcome: BlackjackOutcome, state: TState) => TState
  getPayoutMultiplier: (state: TState) => number
}

export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface BlackjackCard {
  suit: Suit
  rank: Rank
}

export type BlackjackOutcome = 'win' | 'loss' | 'push'

export interface BlackjackState {
  deck: BlackjackCard[]
  playerHand: BlackjackCard[]
  dealerHand: BlackjackCard[]
  betAmount: number
  stage: 'betting' | 'inProgress' | 'settled'
  outcome: BlackjackOutcome | null
  payoutMultiplier: number
  message: string
  canDouble: boolean
  playerBlackjack: boolean
  dealerBlackjack: boolean
}
