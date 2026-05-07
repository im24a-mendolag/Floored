import type { DiceSide, DiceState, DiceOutcome } from './types'

const WEIGHTS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
}

const TOTAL_WEIGHT = 36

function randomRoll(): number {
  const roll = Math.floor(Math.random() * 6) + 1
  const second = Math.floor(Math.random() * 6) + 1
  return roll + second
}

export function getWinWeight(threshold: number, side: DiceSide) {
  return Object.entries(WEIGHTS).reduce((sum, [value, weight]) => {
    const num = Number(value)
    const isWinning = side === 'under' ? num < threshold : num > threshold
    return isWinning ? sum + weight : sum
  }, 0)
}

export function getPushWeight(threshold: number) {
  return WEIGHTS[threshold] ?? 0
}

export function getWinProbability(threshold: number, side: DiceSide) {
  return getWinWeight(threshold, side) / TOTAL_WEIGHT
}

export function getPushProbability(threshold: number) {
  return getPushWeight(threshold) / TOTAL_WEIGHT
}

export function getPayoutMultiplier(threshold: number, side: DiceSide) {
  const winProbability = getWinProbability(threshold, side)
  if (winProbability <= 0) return 0
  return Math.max(1.05, Number(((1 / winProbability) * 0.92).toFixed(2)))
}

export function initDice(): DiceState {
  return {
    stage: 'betting',
    threshold: 7,
    side: 'under',
    betAmount: 0,
    rollResult: null,
    payoutMultiplier: getPayoutMultiplier(7, 'under'),
    outcome: null,
    message: 'Choose your threshold and place your bet.',
  }
}

export function startDiceRound(amount: number, threshold: number, side: DiceSide): DiceState {
  return {
    stage: 'inProgress',
    threshold,
    side,
    betAmount: amount,
    rollResult: null,
    payoutMultiplier: getPayoutMultiplier(threshold, side),
    outcome: null,
    message: `Rolling for ${side === 'under' ? 'under' : 'over'} ${threshold}.`, 
  }
}

export function resolveDiceRound(state: DiceState): DiceState {
  if (state.stage !== 'inProgress') return state

  const rollResult = randomRoll()
  const isPush = rollResult === state.threshold
  const isWin = state.side === 'under' ? rollResult < state.threshold : rollResult > state.threshold
  const outcome: DiceOutcome = isPush ? 'push' : isWin ? 'win' : 'loss'

  return {
    ...state,
    stage: 'settled',
    rollResult,
    outcome,
    message:
      outcome === 'win'
        ? `You win with a ${rollResult}!`
        : outcome === 'push'
        ? `Push on ${rollResult}. Your stake is returned.`
        : `You lose with a ${rollResult}.`,
  }
}

export function getDiceResultPayout(state: DiceState) {
  if (state.outcome === 'win') return Math.round(state.betAmount * state.payoutMultiplier)
  if (state.outcome === 'push') return state.betAmount
  return 0
}
