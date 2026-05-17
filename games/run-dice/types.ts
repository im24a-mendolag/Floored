export type RunDiceOutcome = 'win' | 'loss' | 'push'

export interface RunDiceConfig {
  win: number[]
  loss: number[]
  neutral: number[]
}

export interface RunDiceState {
  stage: 'betting' | 'inProgress' | 'settled'
  config: RunDiceConfig
  betAmount: number
  rollCount: number
  rollResult: number | null
  dice: [number, number] | null
  payoutMultiplier: number
  outcome: RunDiceOutcome | null
  message: string
}
