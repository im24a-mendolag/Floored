import type { CoinFlipState, CoinSide } from './types'

function flip(): CoinSide {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function initCoinFlip(): CoinFlipState {
  return {
    stage: 'betting',
    betAmount: 0,
    pick: null,
    nextPick: null,
    lastResult: null,
    streak: 0,
    multiplier: 2,
    outcome: null,
    message: 'Pick a side and flip!',
  }
}

export function startFlip(bet: number, pick: CoinSide): CoinFlipState {
  const result = flip()
  const won = result === pick

  if (!won) {
    return {
      stage: 'settled',
      betAmount: bet,
      pick,
      nextPick: null,
      lastResult: result,
      streak: 0,
      multiplier: 0,
      outcome: 'loss',
      message: `${cap(result)} — Better luck next time!`,
    }
  }

  return {
    stage: 'riding',
    betAmount: bet,
    pick,
    nextPick: null,
    lastResult: result,
    streak: 1,
    multiplier: 2,
    outcome: null,
    message: 'Correct! Cash out or push your luck.',
  }
}

export function flipAgain(state: CoinFlipState): CoinFlipState {
  if (!state.nextPick) return state

  const result = flip()
  const won = result === state.nextPick

  if (!won) {
    return {
      ...state,
      stage: 'settled',
      pick: state.nextPick,
      nextPick: null,
      lastResult: result,
      streak: 0,
      multiplier: 0,
      outcome: 'loss',
      message: `${cap(result)} — You lose everything!`,
    }
  }

  const newStreak = state.streak + 1
  const newMult = Math.pow(2, newStreak)

  return {
    ...state,
    stage: 'riding',
    pick: state.nextPick,
    nextPick: null,
    lastResult: result,
    streak: newStreak,
    multiplier: newMult,
    outcome: null,
    message: `${newStreak} in a row! Cash out or push your luck.`,
  }
}

export function cashOut(state: CoinFlipState): CoinFlipState {
  return {
    ...state,
    stage: 'settled',
    outcome: 'win',
    message: `Cashed out at ${state.multiplier}×!`,
  }
}
