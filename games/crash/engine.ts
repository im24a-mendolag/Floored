import type { CrashState } from './types'

// Multiplier = e^(GROWTH_RATE * t_seconds)
// 1s → ~1.26×  |  3s → ~2×  |  5s → ~3.2×  |  10s → ~10×
const GROWTH_RATE = 0.23

const MIN_CRASH = 1.05
const MAX_CRASH = 30.0
const HOUSE_EDGE = 0.95

function generateCrashPoint(): number {
  const u = Math.random()
  return parseFloat(Math.min(MAX_CRASH, HOUSE_EDGE / u).toFixed(2))
}

export function computeMultiplier(elapsedMs: number): number {
  return parseFloat(Math.exp(GROWTH_RATE * elapsedMs / 1000).toFixed(2))
}

export function initCrash(): CrashState {
  return {
    stage: 'betting',
    betAmount: 0,
    currentMultiplier: 1.0,
    crashAt: generateCrashPoint(),
    payoutMultiplier: 1.0,
    outcome: null,
    message: 'Place your bet to start.',
  }
}

export function startCrashRound(amount: number): CrashState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: 1.0,
    crashAt: generateCrashPoint(),
    payoutMultiplier: 1.0,
    outcome: null,
    message: 'Multiplier is climbing — cash out before it crashes!',
  }
}

/**
 * Blessed round: crash point is forced to MAX_CRASH (30×), giving the player
 * ample time to cash out at a large multiplier.
 */
export function winGame(amount: number): CrashState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: 1.0,
    crashAt: MAX_CRASH,
    payoutMultiplier: 1.0,
    outcome: null,
    message: 'Multiplier is climbing — cash out before it crashes!',
  }
}

/**
 * Cursed round: crash point is forced to MIN_CRASH (1.05×), which is reached
 * in ~200ms — physically impossible for a player to cash out profitably.
 */
export function loseGame(amount: number): CrashState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: 1.0,
    crashAt: MIN_CRASH,
    payoutMultiplier: 1.0,
    outcome: null,
    message: 'Multiplier is climbing — cash out before it crashes!',
  }
}

export function getCrashPayout(state: CrashState): number {
  if (state.outcome === 'win') return Math.round(state.betAmount * state.payoutMultiplier)
  return 0
}
