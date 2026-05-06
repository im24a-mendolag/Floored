export type Difficulty = 'normal' | 'hard' | 'nightmare'

export type GameMode = 'survival' | 'freeplay'

export type GameName =
  | 'blackjack'
  | 'crash'
  | 'plinko'
  | 'hilo'
  | 'dice'
  | 'run-dice'
  | 'mines'
  | 'chicken-road'
  | 'slots'

export interface Modifier {
  id: string
  name: string
  description: string
  effect: Record<string, unknown>
}

export interface GameResult {
  id: string
  game: GameName
  floor: number
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | 'push'
  multiplier?: number
  playedAt: Date
}

export interface DiceConfig {
  win: number[]
  loss: number[]
}

export interface SurvivalStore {
  bankroll: number
  setBankroll: (n: number) => void
  sparks: number
  addSparks: (n: number) => void
  spendSparks: (n: number) => void
  runActive: boolean
  runSeed: string | null
  gamesPlayed: number
  streak: number
  currentFloor: number
  slotsUsed: number
  floorMinBet: number
  diceConfig: DiceConfig
  jackpotMeter: number
  difficulty: Difficulty | null
  modifiers: Modifier[]
  history: GameResult[]
  startRun: (difficulty: Difficulty) => void
  endRun: () => void
  advanceFloor: () => void
  recordResult: (result: GameResult) => void
}

export interface FreeplayStore {
  bankroll: number
  setBankroll: (n: number) => void
  reset: () => void
}
