import type { PurchasedUpgrade } from '@/store/types'

export const MAX_UPGRADE_LEVEL = 5

/** Game-specific payout boost multiplier by level (L1–L5). */
export const GAME_PAYOUT_MULT_BY_LEVEL = [1.05, 1.12, 1.20, 1.30, 1.40] as const

/** Run-wide payout boost multiplier by level (L1–L5). */
export const RUN_PAYOUT_MULT_BY_LEVEL = [1.05, 1.10, 1.15, 1.20, 1.25] as const

/** Opening Ticket: free-bet cap as × floor minimum bet. */
export const OPENING_TICKET_CAP_BY_LEVEL = [10, 12, 16, 22, 30] as const

/** Weighted coin: win chance for the player's pick. Index 0 unused; index = perk level (1–5). */
export const COIN_BIAS_CHANCE_BY_LEVEL = [0, 0.54, 0.57, 0.6, 0.63, 0.65] as const

/** Crash Zone: early-crash push threshold (×). Index 0 unused; index = perk level (1–5). */
export const CRASH_ZONE_THRESHOLD_BY_LEVEL = [0, 1.0, 1.05, 1.1, 1.2, 1.3] as const

const LEGACY_UPGRADE_ID_MAP: Record<string, string> = {
  payout_boost_5: 'run_payout_boost_l1',
  payout_boost_10: 'run_payout_boost_l2',
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

// Re-exported from upgrades-catalog to avoid breaking existing imports
export type { PurchasedUpgrade }
