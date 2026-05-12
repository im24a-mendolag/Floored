import type { CrashState } from './types'

// Multiplier = e^(GROWTH_RATE * t_seconds)
// 1s → ~1.26×  |  3s → ~2×  |  5s → ~3.2×  |  10s → ~10×
const GROWTH_RATE = 0.23

const MIN_CRASH = 1.05
const MAX_CRASH = 30.0

function generateCrashPoint(): number {
  const skewed = Math.pow(Math.random(), 2.5)
  return parseFloat((MIN_CRASH + skewed * (MAX_CRASH - MIN_CRASH)).toFixed(2))
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

export function getCrashPayout(state: CrashState): number {
  if (state.outcome === 'win') return Math.round(state.betAmount * state.payoutMultiplier)
  return 0
}
