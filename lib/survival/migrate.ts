import type { Difficulty, PurchasedUpgrade } from '@/store/types'
import { SURVIVAL_GAME_POOL, calcQuotaTarget, FLOOR_DURATION_MS } from './balance'
import { generateFloor } from './floor-generator'
import { getCatalogItem, normalizeUpgradeId } from './upgrades-catalog'
import { getMaxOwnedLevelInFamily } from './upgrade-levels'

function migratePurchasedUpgradeIds(raw: unknown): PurchasedUpgrade[] {
  if (!Array.isArray(raw)) return []
  const byFamily = new Map<string, PurchasedUpgrade>()
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const id = typeof rec.id === 'string' ? normalizeUpgradeId(rec.id) : null
    if (!id) continue
    const purchasedAt =
      typeof rec.purchasedAt === 'string' ? rec.purchasedAt : new Date().toISOString()
    const item = getCatalogItem(id)
    const familyId = item?.familyId ?? id
    const existing = byFamily.get(familyId)
    if (!existing) {
      byFamily.set(familyId, { id, purchasedAt })
      continue
    }
    const existingItem = getCatalogItem(existing.id)
    if ((item?.level ?? 0) >= (existingItem?.level ?? 0)) {
      byFamily.set(familyId, { id, purchasedAt })
    }
  }
  return [...byFamily.values()]
}

/**
 * Zustand persist migration callback for the floored-survival key.
 */
export function migratePersistedState(raw: unknown, fromVersion: number): unknown {
  if (fromVersion >= 4) return raw

  const s =
    raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  let base: Record<string, unknown> = { ...s }

  if (fromVersion < 3) {
    const floor = typeof s.currentFloor === 'number' ? s.currentFloor : 1
    const difficulty = (s.difficulty as Difficulty | null) ?? null
    const runSeed = typeof s.runSeed === 'string' ? s.runSeed : null
    const startBankroll = typeof s.bankroll === 'number' ? s.bankroll : 1000

    let quotaTarget = calcQuotaTarget(floor, difficulty ?? 'normal')
    let floorGames = SURVIVAL_GAME_POOL.slice(0, 6)
    let missions: unknown[] = []

    if (runSeed && difficulty) {
      try {
        const generated = generateFloor({
          runSeed,
          floor,
          difficulty,
          survivalGamePool: SURVIVAL_GAME_POOL,
        })
        quotaTarget = generated.quotaTarget
        floorGames = generated.floorGames
        missions = generated.missions
      } catch {
        // fall through to defaults
      }
    }

    const bankroll = typeof s.bankroll === 'number' ? s.bankroll : startBankroll
    const quotaTargetVal = typeof s.quotaTarget === 'number' ? s.quotaTarget : quotaTarget
    const hadStaleQuotaComplete = fromVersion < 3 && s.floorComplete === true

    base = {
      ...s,
      floorComplete: hadStaleQuotaComplete ? false : s.floorComplete === true,
      quotaTarget: quotaTargetVal,
      floorStartBankroll:
        typeof s.floorStartBankroll === 'number' ? s.floorStartBankroll : startBankroll,
      floorGames: Array.isArray(s.floorGames) && s.floorGames.length > 0 ? s.floorGames : floorGames,
      missions: Array.isArray(s.missions) && s.missions.length > 0 ? s.missions : missions,
      completedMissionIds: Array.isArray(s.completedMissionIds) ? s.completedMissionIds : [],
      inventory: Array.isArray(s.inventory) ? s.inventory : [],
      floorHistory: Array.isArray(s.floorHistory) ? s.floorHistory : [],
      firstBetInsuranceUsed:
        typeof s.firstBetInsuranceUsed === 'boolean' ? s.firstBetInsuranceUsed : false,
      shopRerollCount: typeof s.shopRerollCount === 'number' ? s.shopRerollCount : 0,
      missionRerollCount: typeof s.missionRerollCount === 'number' ? s.missionRerollCount : 0,
      lobbyRerollCount: typeof s.lobbyRerollCount === 'number' ? s.lobbyRerollCount : 0,
      runDefeated: typeof s.runDefeated === 'boolean' ? s.runDefeated : false,
      defeatReason:
        s.defeatReason === 'bust' || s.defeatReason === 'quota' ? s.defeatReason : null,
      pendingDefeatReason:
        s.pendingDefeatReason === 'bust' || s.pendingDefeatReason === 'quota'
          ? s.pendingDefeatReason
          : null,
      endlessMode: typeof s.endlessMode === 'boolean' ? s.endlessMode : false,
      quotaMet: typeof s.quotaMet === 'boolean' ? s.quotaMet : bankroll >= quotaTargetVal,
      floorTimeRemainingMs: hadStaleQuotaComplete
        ? FLOOR_DURATION_MS
        : typeof s.floorTimeRemainingMs === 'number'
          ? s.floorTimeRemainingMs
          : FLOOR_DURATION_MS,
      floorTimerPaused: typeof s.floorTimerPaused === 'boolean' ? s.floorTimerPaused : false,
      floorTimerSyncedAt:
        typeof s.floorTimerSyncedAt === 'number' ? s.floorTimerSyncedAt : Date.now(),
    }
  }

  const streakShieldsUsedThisFloor =
    typeof base.streakShieldsUsedThisFloor === 'number'
      ? base.streakShieldsUsedThisFloor
      : base.streakShieldUsed === true
        ? 1
        : 0

  return {
    ...base,
    version: 4,
    purchasedUpgrades: migratePurchasedUpgradeIds(base.purchasedUpgrades),
    streakShieldsUsedThisFloor,
  }
}
