import type { CoinSide } from '@/games/coin-flip/types'
import type { GameName, PurchasedUpgrade } from '@/store/types'
import { getCatalogItem } from './upgrades-catalog'

export function hasEffect(purchasedUpgrades: PurchasedUpgrade[], effectKey: string, game?: GameName): boolean {
  return purchasedUpgrades.some((pu) => {
    const item = getCatalogItem(pu.id)
    if (!item || item.effectKey !== effectKey) return false
    if (item.scope === 'run') return true
    return game != null && item.game === game
  })
}

export function hasGamePerk(purchasedUpgrades: PurchasedUpgrade[], game: GameName, effectKey: string): boolean {
  return hasEffect(purchasedUpgrades, effectKey, game)
}

function parsePayoutMult(effectKey: string): number | null {
  const m = effectKey.match(/^payout_mult_([\d.]+)$/)
  if (!m) return null
  const v = parseFloat(m[1]!)
  return Number.isFinite(v) && v > 0 ? v : null
}

/** Combined payout multiplier from run-wide and game-specific boosts. */
export function computePayoutMultiplier(purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  let mult = 1
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(pu.id)
    if (!item) continue
    const parsed = parsePayoutMult(item.effectKey)
    if (parsed == null) continue
    if (item.scope === 'run' || (item.scope === 'game' && item.game === game)) {
      mult *= parsed
    }
  }
  return mult
}

export function applyPayoutBoost(amount: number, purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  if (amount <= 0) return amount
  return Math.floor(amount * computePayoutMultiplier(purchasedUpgrades, game))
}

export function hasFreeFirstBet(purchasedUpgrades: PurchasedUpgrade[]): boolean {
  return (
    hasEffect(purchasedUpgrades, 'first_bet_free') ||
    hasEffect(purchasedUpgrades, 'first_bet_refund')
  )
}

/** True when the Opening Ticket free first bet is still available this floor. */
export function isOpeningBetFreeAvailable(state: {
  currentFloor: number
  history: { floor: number }[]
  firstBetInsuranceUsed: boolean
  purchasedUpgrades: PurchasedUpgrade[]
  runActive: boolean
}): boolean {
  if (!state.runActive) return false
  const isFirstBetThisFloor = state.history.filter((h) => h.floor === state.currentFloor).length === 0
  return (
    isFirstBetThisFloor &&
    !state.firstBetInsuranceUsed &&
    hasFreeFirstBet(state.purchasedUpgrades)
  )
}

/** Max stake the player can place (covers free opening bet when bankroll is short). */
export function survivalWagerCap(
  bankroll: number,
  openingBetFree: boolean,
  floorMinBet: number,
): number {
  if (!openingBetFree) return bankroll
  return Math.max(bankroll, floorMinBet)
}

export function hasStreakShield(purchasedUpgrades: PurchasedUpgrade[]): boolean {
  return hasEffect(purchasedUpgrades, 'streak_shield')
}

/** Hi-Lo: min/max card value still in deck. */
export function hiloNextCardRange(deck: { value: number }[]): { min: number; max: number } | null {
  if (deck.length === 0) return null
  const values = deck.map((c) => c.value)
  return { min: Math.min(...values), max: Math.max(...values) }
}

/** Pick one chicken guaranteed not to win (for scout perk UI). */
export function pickChickenScoutEliminate(winnerId: number, chickenCount = 4): number {
  const others: number[] = []
  for (let i = 0; i < chickenCount; i++) {
    if (i !== winnerId) others.push(i)
  }
  return others[Math.floor(Math.random() * others.length)]!
}

/** Crash zone band around hidden crash point (±8%). */
export function crashZoneBand(crashAt: number): { low: number; high: number } {
  const pad = crashAt * 0.08
  return {
    low: Math.max(1.01, parseFloat((crashAt - pad).toFixed(2))),
    high: parseFloat((crashAt + pad).toFixed(2)),
  }
}

/** Mines: first safe unrevealed tile id. */
export function findFirstSafeMineTile(tiles: { id: number; hasMine: boolean; revealed: boolean }[]): number | null {
  const safe = tiles.find((t) => !t.hasMine && !t.revealed)
  return safe?.id ?? null
}

/** Roulette: three random numbers (0–36) excluding the winning number. */
export function rouletteEliminatedNumbers(winningNumber: number, count = 3): number[] {
  const pool: number[] = []
  for (let n = 0; n <= 36; n++) {
    if (n !== winningNumber) pool.push(n)
  }
  const out: number[] = []
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0]!)
  }
  return out
}

/** Street cups: one wrong cup to eliminate at pick stage. */
export function streetCupsEliminatedCup(winningSlot: number): number {
  const wrong = [0, 1, 2].filter((s) => s !== winningSlot)
  return wrong[Math.floor(Math.random() * wrong.length)]!
}

/** Keno: pick `count` numbers from 1–80 that will be in the draw (requires draw first). */
export function kenoHeatNumbers(draw: number[], count = 2): number[] {
  return draw.slice(0, count)
}

/** Coin flip with optional 55% player bias. */
export function biasedCoinResult(playerPick: CoinSide): CoinSide {
  return Math.random() < 0.55 ? playerPick : playerPick === 'heads' ? 'tails' : 'heads'
}
