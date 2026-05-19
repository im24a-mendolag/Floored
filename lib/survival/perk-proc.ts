/** Per-bet activation chance for perks that reveal guaranteed safe outcomes. */
export const PROC_PERK_CHANCES: Record<string, number> = {
  perk_mines_safe: 0.35,
  perk_dragon_blindspot: 0.35,
  perk_chicken_road_lane: 0.32,
  perk_chicken_scout: 0.35,
  perk_street_cups_truth: 0.35,
  perk_roulette_tracker: 0.3,
  perk_keno_heat: 0.28,
  perk_plinko_first_ball: 0.35,
  perk_poker_hold_bias: 0.4,
  perk_over_under_shield: 0.35,
  perk_wheel_scout: 0.35,
  perk_slots_shield: 0.35,
}

export function perkRequiresProcRoll(effectKey: string): boolean {
  return effectKey in PROC_PERK_CHANCES
}

export function rollPerkProc(effectKey: string): boolean {
  const chance = PROC_PERK_CHANCES[effectKey]
  if (chance == null) return true
  return Math.random() < chance
}

export function perkProcChancePercent(effectKey: string): number | null {
  const chance = PROC_PERK_CHANCES[effectKey]
  return chance != null ? Math.round(chance * 100) : null
}
