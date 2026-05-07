export type CrashStage = 'betting' | 'inProgress' | 'settled'

export type CrashOutcome = 'win' | 'loss'

export interface CrashState {
  stage: CrashStage
  betAmount: number
  currentMultiplier: number
  crashAt: number
  payoutMultiplier: number
  outcome: CrashOutcome | null
  message: string
}
