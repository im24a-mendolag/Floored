import type { Difficulty } from '@/store/types'
import { OVER_QUOTA_SPARK_MAX, sparkFloorMult } from './balance'

export interface FloorSparksInput {
  floor: number
  bankroll: number
  floorStartBankroll: number
  quotaTarget: number
  difficulty: Difficulty
}

/** Sparks earned when a floor completes (before mission bonuses). */
export function calcFloorSparksEarned(input: FloorSparksInput): number {
  const base = Math.max(8, Math.floor((8 + input.floor * 2) * sparkFloorMult(input.floor)))

  if (input.bankroll < input.quotaTarget) return base

  const overQuota = input.bankroll - input.quotaTarget
  const overBonus = Math.min(
    OVER_QUOTA_SPARK_MAX,
    Math.floor(overQuota / (input.quotaTarget * 0.01)),
  )
  return base + overBonus
}
