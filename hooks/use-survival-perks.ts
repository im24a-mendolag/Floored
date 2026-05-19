'use client'

import { useSurvivalStore } from '@/store/survival-store'
import type { GameName } from '@/store/types'
import {
  computePayoutMultiplier,
  getPerkLevel,
  hasEffect,
  hasGamePerk,
} from '@/lib/survival/survival-perks'

/** Survival-only upgrade flags for a game page. */
export function useSurvivalPerks(game: GameName) {
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)

  const perkLevel = (effectKey: string) => getPerkLevel(purchasedUpgrades, game, effectKey)

  return {
    purchasedUpgrades,
    payoutBoostMult: computePayoutMultiplier(purchasedUpgrades, game),
    hasPerk: (effectKey: string) => hasGamePerk(purchasedUpgrades, game, effectKey),
    hasRunEffect: (effectKey: string) => hasEffect(purchasedUpgrades, effectKey),
    peekDealer: hasGamePerk(purchasedUpgrades, game, 'perk_peek_dealer'),
    peekDealerLevel: perkLevel('perk_peek_dealer'),
    hiloRange: hasGamePerk(purchasedUpgrades, game, 'perk_hilo_range'),
    chickenScout: hasGamePerk(purchasedUpgrades, game, 'perk_chicken_scout'),
    chickenScoutLevel: perkLevel('perk_chicken_scout'),
    crashZone: hasGamePerk(purchasedUpgrades, game, 'perk_crash_zone'),
    minesSafe: hasGamePerk(purchasedUpgrades, game, 'perk_mines_safe'),
    minesSafeLevel: perkLevel('perk_mines_safe'),
    plinkoFirstBall: hasGamePerk(purchasedUpgrades, game, 'perk_plinko_first_ball'),
    plinkoFirstBallLevel: perkLevel('perk_plinko_first_ball'),
    overUnderShield: hasGamePerk(purchasedUpgrades, game, 'perk_over_under_shield'),
    overUnderShieldLevel: perkLevel('perk_over_under_shield'),
    wheelScout: hasGamePerk(purchasedUpgrades, game, 'perk_wheel_scout'),
    wheelScoutLevel: perkLevel('perk_wheel_scout'),
    runDiceInsight: hasGamePerk(purchasedUpgrades, game, 'perk_run_dice_insight'),
    chickenRoadLane: hasGamePerk(purchasedUpgrades, game, 'perk_chicken_road_lane'),
    chickenRoadLaneLevel: perkLevel('perk_chicken_road_lane'),
    slotsShield: hasGamePerk(purchasedUpgrades, game, 'perk_slots_shield'),
    slotsShieldLevel: perkLevel('perk_slots_shield'),
    rouletteTracker: hasGamePerk(purchasedUpgrades, game, 'perk_roulette_tracker'),
    rouletteTrackerLevel: perkLevel('perk_roulette_tracker'),
    dragonBlindspot: hasGamePerk(purchasedUpgrades, game, 'perk_dragon_blindspot'),
    dragonBlindspotLevel: perkLevel('perk_dragon_blindspot'),
    streetCupsTruth: hasGamePerk(purchasedUpgrades, game, 'perk_street_cups_truth'),
    streetCupsTruthLevel: perkLevel('perk_street_cups_truth'),
    caseXray: hasGamePerk(purchasedUpgrades, game, 'perk_case_xray'),
    pokerHoldBias: hasGamePerk(purchasedUpgrades, game, 'perk_poker_hold_bias'),
    pokerHoldBiasLevel: perkLevel('perk_poker_hold_bias'),
    kenoHeat: hasGamePerk(purchasedUpgrades, game, 'perk_keno_heat'),
    kenoHeatLevel: perkLevel('perk_keno_heat'),
    coinBias: hasGamePerk(purchasedUpgrades, game, 'perk_coin_bias'),
    coinBiasLevel: perkLevel('perk_coin_bias'),
  }
}

export function boostedPotential(amount: number, mult: number): number {
  if (amount <= 0 || mult <= 1) return amount
  return Math.floor(amount * mult)
}
