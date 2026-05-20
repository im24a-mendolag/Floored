import type { OverUnderOutcome, OverUnderState } from './types'

function randomRoll() {
  return Math.floor(Math.random() * 100) + 1
}

export function getOverUnderPayoutMultiplier(safeZone: number) {
  const safeRatio = safeZone / 100
  if (safeRatio <= 0) return 0
  return Number((Math.max(1 / safeRatio, 1.05) * 0.92).toFixed(2))
}

export function initOverUnder(): OverUnderState {
  const safeZone = 40
  return {
    stage: 'betting',
    safeZone,
    betAmount: 0,
    rollResult: null,
    payoutMultiplier: getOverUnderPayoutMultiplier(safeZone),
    outcome: null,
    message: 'Choose your safe zone and place your bet.',
  }
}

export function startOverUnderRound(amount: number, safeZone: number): OverUnderState {
  return {
    stage: 'inProgress',
    safeZone,
    betAmount: amount,
    rollResult: null,
    payoutMultiplier: getOverUnderPayoutMultiplier(safeZone),
    outcome: null,
    message: `Safe zone is ${safeZone}%. Place your bet.`,
  }
}

export function resolveOverUnderRound(state: OverUnderState): OverUnderState {
  if (state.stage !== 'inProgress') return state

  const rollResult = randomRoll()
  const isWin = rollResult <= state.safeZone
  const outcome: OverUnderOutcome = isWin ? 'win' : 'loss'

  return {
    ...state,
    stage: 'settled',
    rollResult,
    outcome,
    message:
      outcome === 'win'
        ? `You win with ${rollResult}!`
        : `You lose with ${rollResult}.`,
  }
}

export function getOverUnderPayout(state: OverUnderState) {
  return state.outcome === 'win' ? Math.round(state.betAmount * state.payoutMultiplier) : 0
}

/**
 * Blessed resolve: forces the roll within the safe zone so the player always
 * wins. The value is random within the winning range so it looks natural.
 */
export function winGameResolve(state: OverUnderState): OverUnderState {
  if (state.stage !== 'inProgress') return state
  const rollResult = Math.floor(Math.random() * state.safeZone) + 1
  return {
    ...state,
    stage: 'settled',
    rollResult,
    outcome: 'win',
    message: `You win with ${rollResult}!`,
  }
}

/**
 * Cursed resolve: forces the roll above the safe zone so the player always
 * loses. The value is still random within the losing range so it looks natural.
 */
export function loseGameResolve(state: OverUnderState): OverUnderState {
  if (state.stage !== 'inProgress') return state
  const rollResult = Math.floor(state.safeZone + 1 + Math.random() * (100 - state.safeZone))
  return {
    ...state,
    stage: 'settled',
    rollResult,
    outcome: 'loss',
    message: `You lose with ${rollResult}.`,
  }
}
