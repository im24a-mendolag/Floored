export type RouletteColor = 'red' | 'black' | 'green'

export type RouletteBetType =
  | 'red' | 'black' | 'green'
  | 'odd' | 'even'
  | 'low' | 'high'
  | 'dozen1' | 'dozen2' | 'dozen3'

// Keys: RouletteBetType ('red', 'dozen1', etc.) or stringified number ('0'–'36')
export type BetMap = Record<string, number>

export interface RouletteState {
  stage: 'betting' | 'settled'
  result: number | null
  resultColor: RouletteColor | null
  outcome: 'win' | 'loss' | 'push' | null
  totalBetAmount: number
  totalPayout: number
  message: string
}
