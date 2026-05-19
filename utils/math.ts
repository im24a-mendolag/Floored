const FLOOR_MIN_BETS: Record<number, number> = {
  1:    20,
  2:    50,
  3:   100,
  4:   200,
  5:   500,
  6:  1000,
  7:  2000,
  8:  4000,
  9:  7000,
  10: 10000,
}

export function getFloorMinBet(floor: number): number {
  if (floor <= 10) return FLOOR_MIN_BETS[floor] ?? 10
  let bet = 10000
  for (let f = 11; f <= floor; f++) {
    bet = Math.floor(bet * 1.5)
  }
  return bet
}

export function calculatePayout(bet: number, multiplier: number): number {
  return Math.floor(bet * multiplier)
}
