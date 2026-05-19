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
  type: string
  target: number
  progress: number
  rewardSparks: number
  completed: boolean
  /** Required for play_game missions */
  game?: GameName
  /** Minimum bet for play_game missions (floor min bet at generation) */
  minBet?: number
  /** Set when a mission can no longer be completed (e.g. flawless after a loss) */
  failed?: boolean
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

export type DefeatReason = 'bust' | 'quota'

export interface RunSummary {
  endedAt: string
  endBankroll: number
  floorsReached: number
  gamesPlayed: number
  peakBankroll: number
  sparksEarned: number
  difficulty: Difficulty | null
  victory?: boolean
  /** True if the player continued past floor 10 into endless mode. */
  endlessMode?: boolean
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

  /** True after the floor timer expires with quota met — advance / victory flow. */
  floorComplete: boolean
  /** Pending defeat — shown after the player clicks Next in the current game. */
  pendingDefeatReason: DefeatReason | null
  /** True once defeat overlay is active. */
  runDefeated: boolean
  defeatReason: DefeatReason | null
  /** True once bankroll reaches quotaTarget (does not end the floor). */
  quotaMet: boolean
  /** Milliseconds left on the current floor timer. */
  floorTimeRemainingMs: number
  floorTimerPaused: boolean
  /** Epoch ms when floorTimeRemainingMs was last synced. */
  floorTimerSyncedAt: number
  /** Streak shield consumable-like run upgrade — first loss per floor ignored. */
  streakShieldUsed: boolean
  /** Opening Ticket — free first bet per floor consumed. */
  firstBetInsuranceUsed: boolean
  /** Rerolls used on shop offers this floor (escalating spark cost). */
  shopRerollCount: number
  /** Rerolls used on floor missions this floor (escalating spark cost). */
  missionRerollCount: number
  /** Lobby slot rerolls used this floor (seed variance). */
  lobbyRerollCount: number
  /** Player chose to continue past floor 10. */
  endlessMode: boolean

  // ── Actions ──────────────────────────────────────────────────────────────
  startRun: (difficulty: Difficulty) => void
  endRun: (opts?: { victory?: boolean }) => void
  abandonRun: () => void
  advanceFloor: () => void
  continueToEndless: () => void
  dismissFloorComplete: () => void
  syncFloorTimer: () => number
  toggleFloorTimerPause: () => void
  completeFloorFromTimer: () => void
  finishQuotaEarly: () => void
  queueDefeat: (reason: DefeatReason) => void
  confirmPendingDefeat: () => void
  setRunDefeated: (reason: DefeatReason) => void
  confirmDefeat: () => void
  clearLastRun: () => void
  setMissions: (missions: FloorMission[]) => void
  applyMissionResults: (updatedMissions: FloorMission[]) => void
  purchaseUpgrade: (id: string, price: number) => boolean
  purchaseLobbyRerollTicket: () => boolean
  rerollLobbyGame: (slotIndex: number) => boolean
  rerollShop: () => boolean
  rerollMissions: () => boolean
  appendFloorHistory: (record: FloorRecord) => void
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
