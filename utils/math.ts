const FLOOR_MIN_BETS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 50,
  4: 100,
  5: 200,
  6: 500,
  7: 1000,
  8: 2000,
  9: 5000,
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
