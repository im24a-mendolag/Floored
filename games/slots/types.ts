export type SlotsSymbol = 'cherry' | 'bar' | 'bell' | 'diamond' | 'seven' | 'wild'

export type SlotsOutcome = 'win' | 'loss'

export interface SlotsState {
  stage: 'betting' | 'settled'
  betAmount: number
  reels: [SlotsSymbol, SlotsSymbol, SlotsSymbol] | null
  outcome: SlotsOutcome | null
  payoutMultiplier: number
  winType: string | null
  isJackpotSpin: boolean
  message: string
}
