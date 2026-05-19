export type Difficulty = 'normal' | 'hard' | 'nightmare'

export type GameMode = 'survival' | 'freeplay'

export type GameName =
  | 'blackjack'
  | 'crash'
  | 'plinko'
  | 'over-under'
  | 'hilo'
  | 'keno'
  | 'street-cups'
  | 'wheel'
  | 'run-dice'
  | 'mines'
  | 'chicken-road'
  | 'slots'
  | 'roulette'
  | 'dragon-tower'
  | 'chicken-race'
  | 'coin-flip'
  | 'case-battles'
  | 'poker-1p'

export interface Modifier {
  id: string
  name: string
  description: string
  effect: Record<string, unknown>
}

// ── Survival run-schema types (Step 2) ──────────────────────────────────────

export interface FloorMission {
  id: string
  /** e.g. 'win_streak' | 'profit_target' — extensible in Step 8 */
  type: string
  target: number
  progress: number
  rewardSparks: number
  completed: boolean
}

export interface PurchasedUpgrade {
  id: string
  /** ISO date string */
  purchasedAt: string
}

export interface ConsumableStack {
  id: string
  count: number
}

export interface FloorRecord {
  floor: number
  quotaTarget: number
  quotaAchieved: number
  floorGames: GameName[]
  endBankroll: number
  /** ISO date string */
  completedAt: string
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
  neutral: number[]
}

export interface RunSummary {
  endedAt: string
  endBankroll: number
  floorsReached: number
  gamesPlayed: number
  peakBankroll: number
  sparksEarned: number
  difficulty: Difficulty | null
}

export interface SurvivalStore {
  // ── Core run state ───────────────────────────────────────────────────────
  /** Schema version for persist migration (always 1 after Step 2). */
  version: number
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
  peakBankroll: number
  lastRun: RunSummary | null

  // ── Per-floor generated state (Step 2 / 3) ───────────────────────────────
  /** Bankroll value the player must reach to clear this floor. */
  quotaTarget: number
  /** Bankroll at the start of the current floor — used to compute net progress. */
  floorStartBankroll: number
  /** Six unique games available on this floor (seeded, deterministic). */
  floorGames: GameName[]
  /** Active missions for this floor (populated in Step 8). */
  missions: FloorMission[]
  /** Mission IDs completed across the run. */
  completedMissionIds: string[]
  /** Upgrades purchased from the shop. */
  purchasedUpgrades: PurchasedUpgrade[]
  /** Consumable items in the player's inventory. */
  inventory: ConsumableStack[]
  /** Historical record of completed floors. */
  floorHistory: FloorRecord[]

  /** True after quota is met, cleared when modal is dismissed and floor advances. */
  floorComplete: boolean

  // ── Actions ──────────────────────────────────────────────────────────────
  startRun: (difficulty: Difficulty) => void
  endRun: () => void
  abandonRun: () => void
  advanceFloor: () => void
  dismissFloorComplete: () => void
  recordResult: (result: GameResult) => void
  recordResultPayout: (result: GameResult) => void
  deductBet: (amount: number) => void
  resetJackpotMeter: () => void
}

export interface FreeplayStore {
  bankroll: number
  setBankroll: (n: number) => void
  bust: boolean
  markBust: () => void
  reset: () => void
}
