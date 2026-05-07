export type PlinkoStage = 'betting' | 'inProgress' | 'settled'

export interface PlinkoState {
  stage: PlinkoStage
  betAmount: number
  path: number[]
  finalSlot: number | null
  payoutMultiplier: number
  outcome: 'win' | 'loss' | 'push' | null
  message: string
}
