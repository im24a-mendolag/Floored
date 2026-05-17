import type { SlotsState, SlotsSymbol } from './types'

// Weighted reel — rarer symbols = higher payouts
const REEL: { symbol: SlotsSymbol; weight: number }[] = [
  { symbol: 'cherry',  weight: 8 },
  { symbol: 'bar',     weight: 6 },
  { symbol: 'bell',    weight: 4 },
  { symbol: 'diamond', weight: 3 },
  { symbol: 'seven',   weight: 2 },
  { symbol: 'wild',    weight: 1 },
]

const TOTAL_WEIGHT = REEL.reduce((s, r) => s + r.weight, 0)

function spinReel(): SlotsSymbol {
  let r = Math.random() * TOTAL_WEIGHT
  for (const { symbol, weight } of REEL) {
    r -= weight
    if (r <= 0) return symbol
  }
  return 'cherry'
}

function resolveReels(
  reels: [SlotsSymbol, SlotsSymbol, SlotsSymbol],
): { multiplier: number; winType: string | null } {
  // Wilds substitute for the best non-wild symbol on the payline
  const nonWilds = reels.filter((s) => s !== 'wild')
  const bestNonWild = nonWilds[0] ?? 'cherry'
  const effective = reels.map((s) => (s === 'wild' ? bestNonWild : s)) as [
    SlotsSymbol,
    SlotsSymbol,
    SlotsSymbol,
  ]

  const [a, b, c] = effective

  // Three of a kind
  if (a === b && b === c) {
    switch (a) {
      case 'seven':   return { multiplier: 50,  winType: 'THREE SEVENS' }
      case 'diamond': return { multiplier: 25,  winType: 'Three Diamonds' }
      case 'bell':    return { multiplier: 15,  winType: 'Three Bells' }
      case 'bar':     return { multiplier: 10,  winType: 'Triple BAR' }
      case 'cherry':  return { multiplier: 5,   winType: 'Three Cherries' }
    }
  }

  // Two cherries (any positions)
  const cherries = effective.filter((s) => s === 'cherry').length
  if (cherries >= 2) return { multiplier: 0.5, winType: 'Two Cherries' }

  // Two bars (any positions)
  const bars = effective.filter((s) => s === 'bar').length
  if (bars >= 2) return { multiplier: 0.5, winType: 'Double BAR' }

  return { multiplier: 0, winType: null }
}

export function initSlots(): SlotsState {
  return {
    stage: 'betting',
    betAmount: 0,
    reels: null,
    outcome: null,
    payoutMultiplier: 0,
    winType: null,
    isJackpotSpin: false,
    message: 'Place your bet and spin.',
  }
}

export function spinSlots(betAmount: number, jackpotReady: boolean): SlotsState {
  let reels: [SlotsSymbol, SlotsSymbol, SlotsSymbol]

  if (jackpotReady) {
    // Guaranteed jackpot — force three sevens
    reels = ['seven', 'seven', 'seven']
  } else {
    reels = [spinReel(), spinReel(), spinReel()]
  }

  const { multiplier, winType } = jackpotReady
    ? { multiplier: 100, winType: 'JACKPOT — THREE SEVENS' }
    : resolveReels(reels)

  const outcome: 'win' | 'loss' = multiplier > 0 ? 'win' : 'loss'
  const payout = Math.round(betAmount * multiplier)

  const message = jackpotReady
    ? 'JACKPOT! Three Sevens — 100×!'
    : multiplier > 0
    ? `${winType}! You win ${multiplier}×.`
    : 'No match. Better luck next spin.'

  return {
    stage: 'settled',
    betAmount,
    reels,
    outcome,
    payoutMultiplier: jackpotReady ? 100 : multiplier,
    winType: jackpotReady ? 'JACKPOT' : winType,
    isJackpotSpin: jackpotReady,
    message,
  }
}

export function getSlotsResultPayout(state: SlotsState): number {
  return Math.round(state.betAmount * state.payoutMultiplier)
}

// Expose the full paytable for display
export const PAYTABLE: { label: string; symbols: SlotsSymbol[]; multiplier: number }[] = [
  { label: 'Three Sevens',   symbols: ['seven',   'seven',   'seven'],   multiplier: 50  },
  { label: 'Three Diamonds', symbols: ['diamond', 'diamond', 'diamond'], multiplier: 25  },
  { label: 'Triple BAR',     symbols: ['bar',     'bar',     'bar'],     multiplier: 10  },
  { label: 'Double BAR',     symbols: ['bar',     'bar',     'bell'],    multiplier: 0.5 },
  { label: 'Three Cherries', symbols: ['cherry',  'cherry',  'cherry'],  multiplier: 5   },
  { label: 'Two Cherries',   symbols: ['cherry',  'cherry',  'bar'],     multiplier: 0.5 },
  { label: 'Three Bells',    symbols: ['bell',    'bell',    'bell'],    multiplier: 15  },
]
