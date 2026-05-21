import type { CoinSide } from '@/games/coin-flip/types'
import type { GameName, PurchasedUpgrade } from '@/store/types'
import { getCatalogItem, normalizeUpgradeId } from './upgrades-catalog'
import { RAW_PAYOUT_MULT_CAP } from './balance'
import {
  COIN_BIAS_CHANCE_BY_LEVEL,
  CRASH_CUSHION_BY_LEVEL,
  OPENING_TICKET_CAP_BY_LEVEL,
} from './upgrade-levels'
import { getMaxOwnedLevelForEffect } from './upgrades-catalog'

export function hasEffect(purchasedUpgrades: PurchasedUpgrade[], effectKey: string, game?: GameName): boolean {
  if (game) {
    return (
      getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { game, scope: 'game' }) > 0 ||
      getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { scope: 'run' }) > 0
    )
  }
  return getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { scope: 'run' }) > 0
}

export function hasGamePerk(purchasedUpgrades: PurchasedUpgrade[], game: GameName, effectKey: string): boolean {
  return getPerkLevel(purchasedUpgrades, game, effectKey) > 0
}

export function getPerkLevel(
  purchasedUpgrades: PurchasedUpgrade[],
  game: GameName,
  effectKey: string,
): number {
  return getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { game, scope: 'game' })
}

function parsePayoutMultFromEffectKey(effectKey: string): number | null {
  const m = effectKey.match(/^payout_mult_([\d.]+)$/)
  if (!m) return null
  const v = parseFloat(m[1]!)
  return Number.isFinite(v) && v > 0 ? v : null
}

function payoutMultForItem(item: NonNullable<ReturnType<typeof getCatalogItem>>): number | null {
  if (item.payoutMult != null) return item.payoutMult
  return parsePayoutMultFromEffectKey(item.effectKey)
}

/** Combined payout multiplier from run-wide and game-specific boosts. */
export function computePayoutMultiplier(purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  let mult = 1
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(normalizeUpgradeId(pu.id))
    if (!item) continue
    const parsed = payoutMultForItem(item)
    if (parsed == null) continue
    if (item.scope === 'run' || (item.scope === 'game' && item.game === game)) {
      mult *= parsed
    }
  }
  return Math.min(RAW_PAYOUT_MULT_CAP, mult)
}

export function applyPayoutBoost(amount: number, purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  if (amount <= 0) return amount
  return Math.floor(amount * computePayoutMultiplier(purchasedUpgrades, game))
}

export function hasFreeFirstBet(purchasedUpgrades: PurchasedUpgrade[]): boolean {
  return (
    getMaxOwnedLevelForEffect(purchasedUpgrades, 'first_bet_free', { scope: 'run' }) > 0 ||
    hasEffect(purchasedUpgrades, 'first_bet_refund')
  )
}

export function getOpeningTicketCapMultiplier(purchasedUpgrades: PurchasedUpgrade[]): number {
  const level = getMaxOwnedLevelForEffect(purchasedUpgrades, 'first_bet_free', { scope: 'run' })
  if (level <= 0) return 10
  return OPENING_TICKET_CAP_BY_LEVEL[level - 1] ?? 10
}

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

export function survivalWagerCap(
  bankroll: number,
  openingBetFree: boolean,
  openingTicketFreeCap: number,
): number {
  if (!openingBetFree) return bankroll
  return Math.max(bankroll, openingTicketFreeCap)
}

export function getCoinBiasChance(purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  const level = getPerkLevel(purchasedUpgrades, game, 'perk_coin_bias')
  if (level <= 0) return 0.5
  return COIN_BIAS_CHANCE_BY_LEVEL[level] ?? 0.55
}

export function hiloNextCardRange(deck: { value: number }[]): { min: number; max: number } | null {
  if (deck.length === 0) return null
  const values = deck.map((c) => c.value)
  return { min: Math.min(...values), max: Math.max(...values) }
}

export function pickChickenScoutEliminate(winnerId: number, chickenCount = 4): number {
  const others: number[] = []
  for (let i = 0; i < chickenCount; i++) {
    if (i !== winnerId) others.push(i)
  }
  return others[Math.floor(Math.random() * others.length)]!
}

/** Returns the fraction of the bet recovered when crash happens below 3×. */
export function getCrashCushion(level = 1): number {
  return CRASH_CUSHION_BY_LEVEL[Math.max(1, Math.min(5, level)) - 1] ?? 0.25
}

export function findFirstSafeMineTile(tiles: { id: number; hasMine: boolean; revealed: boolean }[]): number | null {
  const safe = tiles.find((t) => !t.hasMine && !t.revealed)
  return safe?.id ?? null
}

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

export function streetCupsEliminatedCup(winningSlot: number): number {
  const wrong = [0, 1, 2].filter((s) => s !== winningSlot)
  return wrong[Math.floor(Math.random() * wrong.length)]!
}

export function kenoHeatNumbers(draw: number[], count = 2): number[] {
  return draw.slice(0, count)
}

export function biasedCoinResult(playerPick: CoinSide, winChance = 0.55): CoinSide {
  return Math.random() < winChance ? playerPick : playerPick === 'heads' ? 'tails' : 'heads'
}
