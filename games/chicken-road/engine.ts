import type { ChickenState, ChickenOutcome } from './types'

const STEP_DATA = [
  { multiplier: 1.2, deathChance: 0.1 },
  { multiplier: 1.5, deathChance: 0.15 },
  { multiplier: 2.0, deathChance: 0.2 },
  { multiplier: 3.0, deathChance: 0.3 },
  { multiplier: 4.5, deathChance: 0.4 },
  { multiplier: 7.0, deathChance: 0.5 },
  { multiplier: 11.0, deathChance: 0.6 },
  { multiplier: 17.0, deathChance: 0.7 },
]

function randomChance() {
  return Math.random()
}

export function initChicken(): ChickenState {
  return {
    stage: 'betting',
    step: 0,
    betAmount: 0,
    multiplier: 1,
    rollResult: null,
    outcome: null,
    message: 'Choose your bet and start the road.',
    cashoutValue: 0,
  }
}

export function startChickenRound(amount: number): ChickenState {
  const firstStep = STEP_DATA[0]!
  return {
    stage: 'inProgress',
    step: 1,
    betAmount: amount,
    multiplier: firstStep.multiplier,
    rollResult: null,
    outcome: null,
    message: `Step 1: ${firstStep.multiplier.toFixed(1)}× with ${firstStep.deathChance * 100}% danger.`,
    cashoutValue: amount,
  }
}

export function advanceChickenRound(state: ChickenState): ChickenState {
  if (state.stage !== 'inProgress') return state

  const stepIndex = state.step - 1
  const stepInfo = STEP_DATA[stepIndex]
  if (!stepInfo) {
    return {
      ...state,
      stage: 'settled',
      outcome: 'loss',
      message: 'Invalid step.',
      multiplier: 0,
      cashoutValue: 0,
    }
  }
  const danger = stepInfo.deathChance
  const roll = randomChance()
  const lost = roll < danger

  if (lost) {
    return {
      ...state,
      stage: 'settled',
      rollResult: Math.round(roll * 100),
      outcome: 'loss',
      message: `Death at step ${state.step}.`,
      multiplier: 0,
      cashoutValue: 0,
    }
  }

  const nextStep = Math.min(state.step + 1, STEP_DATA.length)
  const nextIndex = nextStep - 1
  const nextInfo = STEP_DATA[nextIndex]
  const nextMultiplier = nextInfo?.multiplier ?? state.multiplier

  return {
    ...state,
    step: nextStep,
    multiplier: nextMultiplier,
    rollResult: Math.round(roll * 100),
    message: nextInfo
      ? `Step ${nextStep}: ${nextMultiplier.toFixed(1)}× with ${nextInfo.deathChance * 100}% danger.`
      : state.message,
    cashoutValue: Math.round(state.betAmount * state.multiplier),
  }
}

export function cashOutChicken(state: ChickenState): ChickenState {
  if (state.stage !== 'inProgress') return state
  return {
    ...state,
    stage: 'settled',
    outcome: 'win',
    rollResult: null,
    message: `Cashed out at ${state.multiplier.toFixed(1)}×.`,
    cashoutValue: Math.round(state.betAmount * state.multiplier),
  }
}

export function getChickenPayout(state: ChickenState) {
  return state.outcome === 'win' ? state.cashoutValue : 0
}
