import type { HiloState, HiloOutcome } from './types'

function randomRoll() {
  return Math.floor(Math.random() * 100) + 1
}

export function getHiloPayoutMultiplier(safeZone: number) {
  const safeRatio = safeZone / 100
  if (safeRatio <= 0) return 0
  return Number((Math.max(1 / safeRatio, 1.05) * 0.92).toFixed(2))
}

export function initHilo(): HiloState {
  const safeZone = 40
  return {
    stage: 'betting',
    safeZone,
    betAmount: 0,
    rollResult: null,
    payoutMultiplier: getHiloPayoutMultiplier(safeZone),
    outcome: null,
    message: 'Choose your safe zone and place your bet.',
  }
}

export function startHiloRound(amount: number, safeZone: number): HiloState {
  return {
    stage: 'inProgress',
    safeZone,
    betAmount: amount,
    rollResult: null,
    payoutMultiplier: getHiloPayoutMultiplier(safeZone),
    outcome: null,
    message: `Safe zone is ${safeZone}%. Place your bet.`,
  }
}

export function resolveHiloRound(state: HiloState): HiloState {
  if (state.stage !== 'inProgress') return state

  const rollResult = randomRoll()
  const isWin = rollResult <= state.safeZone
  const outcome: HiloOutcome = isWin ? 'win' : 'loss'

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

export function getHiloPayout(state: HiloState) {
  return state.outcome === 'win' ? Math.round(state.betAmount * state.payoutMultiplier) : 0
}
