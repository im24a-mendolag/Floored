export type DiceSide = 'over' | 'under'
export type DiceOutcome = 'win' | 'loss' | 'push'

export interface DiceState {
  stage: 'betting' | 'inProgress' | 'settled'
  threshold: number
  side: DiceSide
  betAmount: number
  rollResult: number | null
  payoutMultiplier: number
  outcome: DiceOutcome | null
  message: string
}
