export type ChickenOutcome = 'win' | 'loss'

export interface ChickenState {
  stage: 'betting' | 'inProgress' | 'settled'
  step: number
  betAmount: number
  multiplier: number
  rollResult: number | null
  outcome: ChickenOutcome | null
  message: string
  cashoutValue: number
}
