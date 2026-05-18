export type CoinSide = 'heads' | 'tails'
export type CoinFlipStage = 'betting' | 'riding' | 'settled'

export interface CoinFlipState {
  stage: CoinFlipStage
  betAmount: number
  pick: CoinSide | null
  nextPick: CoinSide | null
  lastResult: CoinSide | null
  streak: number
  multiplier: number
  outcome: 'win' | 'loss' | null
  message: string
}
