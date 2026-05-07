import type { CrashState } from './types'

const MIN_CRASH = 1.1
const MAX_CRASH = 6.0
const INCREMENT = 0.15

function generateCrashPoint() {
  const skew = Math.pow(Math.random(), 2)
  return Number((MIN_CRASH + skew * (MAX_CRASH - MIN_CRASH)).toFixed(2))
}

function formatMultiplier(value: number) {
  return Number(value.toFixed(2))
}

export function initCrash(): CrashState {
  return {
    stage: 'betting',
    betAmount: 0,
    currentMultiplier: 1.0,
    crashAt: generateCrashPoint(),
    payoutMultiplier: 1.0,
    outcome: null,
    message: 'Place your bet, then roll to build multiplier before the crash.',
  }
}

export function startCrashRound(amount: number): CrashState {
  const crashAt = generateCrashPoint()
  return {
    stage: 'inProgress',
    betAmount: amount,
    currentMultiplier: 1.0,
    crashAt,
    payoutMultiplier: 1.0,
    outcome: null,
    message: 'Crash is live! Roll to grow the multiplier, then cash out before it crashes.',
  }
}

export function advanceCrash(state: CrashState): CrashState {
  if (state.stage !== 'inProgress') return state

  const nextMultiplier = formatMultiplier(state.currentMultiplier + INCREMENT)
  if (nextMultiplier >= state.crashAt) {
    return {
      ...state,
      stage: 'settled',
      currentMultiplier: state.crashAt,
      payoutMultiplier: 0,
      outcome: 'loss',
      message: `Crash at ${state.crashAt}x! You did not cash out in time.`,
    }
  }

  return {
    ...state,
    currentMultiplier: nextMultiplier,
    payoutMultiplier: nextMultiplier,
    message: `Multiplier is now ${nextMultiplier}x. Cash out before ${state.crashAt}x!`,
  }
}

export function cashOutCrash(state: CrashState): CrashState {
  if (state.stage !== 'inProgress') return state

  return {
    ...state,
    stage: 'settled',
    payoutMultiplier: state.currentMultiplier,
    outcome: 'win',
    message: `Cashed out at ${state.currentMultiplier}x. Nice timing!`,
  }
}

export function getCrashPayout(state: CrashState) {
  if (state.outcome === 'win') return Math.round(state.betAmount * state.payoutMultiplier)
  return 0
}
