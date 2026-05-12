export type WheelColor = 'red' | 'blue' | 'green' | 'gold'

export interface WheelSegment {
  color: WheelColor
  multiplier: number
  count: number
  label: string
}

export interface WheelState {
  stage: 'betting' | 'settled'
  betColor: WheelColor | null
  betAmount: number
  resultColor: WheelColor | null
  resultMultiplier: number
  outcome: 'win' | 'loss' | null
  payoutMultiplier: number
  message: string
}
