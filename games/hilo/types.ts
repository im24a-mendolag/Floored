export type HiloOutcome = 'win' | 'loss'

export interface HiloState {
  stage: 'betting' | 'inProgress' | 'settled'
  safeZone: number
  betAmount: number
  rollResult: number | null
  payoutMultiplier: number
  outcome: HiloOutcome | null
  message: string
}
