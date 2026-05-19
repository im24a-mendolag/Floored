import type { CoinFlipState, CoinSide } from './types'

function flip(biasedPick?: CoinSide, biasChance = 0.55): CoinSide {
  if (biasedPick != null) {
    return Math.random() < biasChance ? biasedPick : biasedPick === 'heads' ? 'tails' : 'heads'
  }
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

export function startFlip(
  bet: number,
  pick: CoinSide,
  opts?: { biasChance?: number },
): CoinFlipState {
  const result = flip(opts?.biasChance != null ? pick : undefined, opts?.biasChance)
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

export function flipAgain(state: CoinFlipState, opts?: { biasChance?: number }): CoinFlipState {
  if (!state.nextPick) return state

  const result = flip(
    opts?.biasChance != null ? state.nextPick : undefined,
    opts?.biasChance,
  )
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

/** Cursed flip: always lands on the opposite side of the player's pick. */
export function loseGame(bet: number, pick: CoinSide): CoinFlipState {
  const result: CoinSide = pick === 'heads' ? 'tails' : 'heads'
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

/** Cursed flip-again: always lands on the opposite side of nextPick, losing everything. */
export function loseFlipAgain(state: CoinFlipState): CoinFlipState {
  if (!state.nextPick) return state
  const result: CoinSide = state.nextPick === 'heads' ? 'tails' : 'heads'
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

export function cashOut(state: CoinFlipState): CoinFlipState {
  return {
    ...state,
    stage: 'settled',
    outcome: 'win',
    message: `Cashed out at ${state.multiplier}×!`,
  }
}
