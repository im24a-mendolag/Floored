import type { PurchasedUpgrade } from '@/store/types'
import { getCatalogItem } from './upgrades-catalog'

export const MAX_UPGRADE_LEVEL = 5

/** Game-specific payout boost multiplier by level (L1–L5). */
export const GAME_PAYOUT_MULT_BY_LEVEL = [1.04, 1.06, 1.08, 1.1, 1.12] as const

/** Run-wide payout boost multiplier by level (L1–L5). */
export const RUN_PAYOUT_MULT_BY_LEVEL = [1.03, 1.05, 1.07, 1.09, 1.11] as const

/** Opening Ticket: free-bet cap as × floor minimum bet. */
export const OPENING_TICKET_CAP_BY_LEVEL = [8, 10, 12, 14, 16] as const

/** Streak Shield: streak saves allowed per floor. */
export const STREAK_SHIELD_CHARGES_BY_LEVEL = [1, 1, 2, 2, 3] as const

/** Weighted coin: win chance for the player’s pick. */
export const COIN_BIAS_CHANCE_BY_LEVEL = [0.52, 0.54, 0.55, 0.57, 0.59] as const

const LEGACY_UPGRADE_ID_MAP: Record<string, string> = {
  payout_boost_5: 'run_payout_boost_l1',
  payout_boost_10: 'run_payout_boost_l2',
  streak_insurance: 'streak_shield_l1',
  first_bet_insurance: 'first_bet_free_l1',
}

const LEGACY_SUFFIX_FAMILIES = ['_boost', '_perk'] as const

export function normalizeUpgradeId(id: string): string {
  if (LEGACY_UPGRADE_ID_MAP[id]) return LEGACY_UPGRADE_ID_MAP[id]!
  for (const suffix of LEGACY_SUFFIX_FAMILIES) {
    if (id.endsWith(suffix) && !/_l\d$/.test(id)) return `${id}_l1`
  }
  return id
}

export function levelCost(baseCost: number, level: number): number {
  return Math.round(baseCost * (1 + (level - 1) * 0.5))
}

export function levelRoman(level: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][level - 1] ?? String(level)
}

export function payoutPercentLabel(mult: number): string {
  return `+${Math.round((mult - 1) * 100)}%`
}

export function getMaxOwnedLevelInFamily(
  purchasedUpgrades: PurchasedUpgrade[],
  familyId: string,
): number {
  let max = 0
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(normalizeUpgradeId(pu.id))
    if (!item || item.familyId !== familyId) continue
    max = Math.max(max, item.level ?? 0)
  }
  return max
}

export function getMaxOwnedLevelForEffect(
  purchasedUpgrades: PurchasedUpgrade[],
  effectKey: string,
  options?: { game?: string; scope?: 'run' | 'game' },
): number {
  let max = 0
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(normalizeUpgradeId(pu.id))
    if (!item || item.effectKey !== effectKey) continue
    if (options?.scope && item.scope !== options.scope) continue
    if (options?.game && item.scope === 'game' && item.game !== options.game) continue
    max = Math.max(max, item.level ?? 0)
  }
  return max
}

export function isUpgradeOfferable(
  item: { id: string; familyId?: string; level?: number },
  ownedIds: string[],
): boolean {
  const normalized = ownedIds.map(normalizeUpgradeId)
  if (normalized.includes(item.id)) return false
  if (!item.familyId || !item.level) return true
  const maxOwned = getMaxOwnedLevelInFamily(
    normalized.map((id) => ({ id, purchasedAt: '' })),
    item.familyId,
  )
  if (maxOwned >= MAX_UPGRADE_LEVEL) return false
  return item.level === maxOwned + 1
}

export function canPurchaseUpgrade(
  id: string,
  purchasedUpgrades: PurchasedUpgrade[],
): boolean {
  const item = getCatalogItem(id)
  if (!item?.familyId || !item.level) return true
  const normalized = purchasedUpgrades.map((u) => normalizeUpgradeId(u.id))
  if (normalized.includes(id)) return false
  const maxOwned = getMaxOwnedLevelInFamily(purchasedUpgrades, item.familyId)
  return item.level === maxOwned + 1
}
