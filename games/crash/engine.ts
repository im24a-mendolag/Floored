import type { CrashState } from './types'

// Multiplier = e^(GROWTH_RATE * t_seconds)
// 1s → ~1.26×  |  3s → ~2×  |  5s → ~3.2×  |  10s → ~10×
const GROWTH_RATE = 0.23
const START_MULT  = 0.75

const MIN_CRASH = 0.8
const MAX_CRASH = 30.0
const HOUSE_EDGE = 0.95

function generateCrashPoint(): number {
  const u = Math.random()
  return parseFloat(Math.min(MAX_CRASH, HOUSE_EDGE / u).toFixed(2))
}

// Curve: 0.75 × e^(0.23t)  →  0.75× at t=0, 1× at ~1.2s, 2× at ~4.2s
export function computeMultiplier(elapsedMs: number): number {
  return parseFloat((START_MULT * Math.exp(GROWTH_RATE * elapsedMs / 1000)).toFixed(2))
}

export function initCrash(): CrashState {
  return {
    stage: 'betting',
    betAmount: 0,
    currentMultiplier: START_MULT,
    crashAt: generateCrashPoint(),
    payoutMultiplier: START_MULT,
    outcome: null,
    message: 'Place your bet to start.',
  }
}

export function startCrashRound(amount: number): CrashState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: START_MULT,
    crashAt: generateCrashPoint(),
    payoutMultiplier: START_MULT,
    outcome: null,
    message: 'Multiplier is climbing — cash out before it crashes!',
  }
}

export function winGame(amount: number): CrashState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: START_MULT,
    crashAt: MAX_CRASH,
    payoutMultiplier: START_MULT,
    outcome: null,
    message: 'Multiplier is climbing — cash out before it crashes!',
  }
}

// Cursed: crashes at 0.80× (~280ms) — impossible to cash out profitably.
export function loseGame(amount: number): CrashState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: START_MULT,
    crashAt: MIN_CRASH,
    payoutMultiplier: START_MULT,
    outcome: null,
    message: 'Multiplier is climbing — cash out before it crashes!',
  }
}
