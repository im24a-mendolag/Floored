export type OverUnderOutcome = 'win' | 'loss'

export interface OverUnderState {
  stage: 'betting' | 'inProgress' | 'settled'
  safeZone: number
  betAmount: number
  rollResult: number | null
  payoutMultiplier: number
  outcome: OverUnderOutcome | null
  message: string
}
