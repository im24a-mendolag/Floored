import type { BetMap, RouletteColor, RouletteBetType, RouletteState } from './types'

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export const STRAIGHT_UP_PAYOUT = 36

export function getNumberColor(n: number): RouletteColor {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

export function isNumberCoveredByBet(n: number, bet: RouletteBetType): boolean {
  switch (bet) {
    case 'red':    return RED_NUMBERS.has(n)
    case 'black':  return n > 0 && !RED_NUMBERS.has(n)
    case 'green':  return n === 0
    case 'odd':    return n > 0 && n % 2 === 1
    case 'even':   return n > 0 && n % 2 === 0
    case 'low':    return n >= 1 && n <= 18
    case 'high':   return n >= 19 && n <= 36
    case 'dozen1': return n >= 1 && n <= 12
    case 'dozen2': return n >= 13 && n <= 24
    case 'dozen3': return n >= 25 && n <= 36
  }
}

// target is either a RouletteBetType string or a stringified number "0"–"36"
export function isNumberCoveredByTarget(n: number, target: string): boolean {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) return n === parsed
  return isNumberCoveredByBet(n, target as RouletteBetType)
}

export const BET_PAYOUTS: Record<RouletteBetType, number> = {
  red: 2,    black: 2,   green: 36,
  odd: 2,    even: 2,
  low: 2,    high: 2,
  dozen1: 3, dozen2: 3,  dozen3: 3,
}

export const BET_LABELS: Record<RouletteBetType, string> = {
  red: 'Red',   black: 'Black', green: 'Zero',
  odd: 'Odd',   even: 'Even',
  low: '1–18',  high: '19–36',
  dozen1: '1–12', dozen2: '13–24', dozen3: '25–36',
}

export function getPayoutForTarget(target: string): number {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) return STRAIGHT_UP_PAYOUT
  return BET_PAYOUTS[target as RouletteBetType] ?? 0
}

export function getLabelForTarget(target: string): string {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) return parsed === 0 ? 'Zero' : `No. ${parsed}`
  return BET_LABELS[target as RouletteBetType] ?? target
}

export function initRoulette(): RouletteState {
  return {
    stage: 'betting',
    result: null,
    resultColor: null,
    outcome: null,
    totalBetAmount: 0,
    totalPayout: 0,
    message: 'Place your bets and spin.',
  }
}

export function spinRouletteMulti(bets: BetMap): RouletteState {
  const result = Math.floor(Math.random() * 37)
  const resultColor = getNumberColor(result)

  let totalBetAmount = 0
  let totalPayout = 0

  for (const [target, amount] of Object.entries(bets)) {
    if (amount <= 0) continue
    totalBetAmount += amount
    if (isNumberCoveredByTarget(result, target)) {
      totalPayout += amount * getPayoutForTarget(target)
    }
  }

  const net = totalPayout - totalBetAmount
  const resultLabel = result === 0 ? 'Zero' : `${result} ${resultColor}`
  const message = net > 0
    ? `${resultLabel} — Win!`
    : totalPayout > 0
      ? `${resultLabel} — Partial.`
      : `${resultLabel} — No win.`

  return {
    stage: 'settled',
    result,
    resultColor,
    outcome: net > 0 ? 'win' : 'loss',
    totalBetAmount,
    totalPayout,
    message,
  }
}
