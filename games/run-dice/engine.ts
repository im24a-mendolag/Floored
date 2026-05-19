import type { RunDiceConfig, RunDiceState, RunDiceOutcome } from './types'

const WEIGHTS: Record<2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, number> = {
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

const SUGGESTED_WIN_COUNT = 2
const SUGGESTED_LOSS_COUNT = 3
const TOTAL_WEIGHT = 36

function randomRoll(): [number, number] {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
}

function pickDistinctSums(count: number, exclude: number[] = []): number[] {
  const sums = Array.from({ length: 11 }, (_, i) => i + 2).filter((sum) => !exclude.includes(sum))
  const result: number[] = []

  while (result.length < count && sums.length) {
    const index = Math.floor(Math.random() * sums.length)
    result.push(sums.splice(index, 1)[0]!)
  }

  return result.sort((a, b) => a - b)
}

export function generateRunDiceConfig(): RunDiceConfig {
  const win = pickDistinctSums(SUGGESTED_WIN_COUNT)
  const loss = pickDistinctSums(SUGGESTED_LOSS_COUNT, win)
  const neutral = Array.from({ length: 11 }, (_, i) => i + 2).filter(
    (value) => !win.includes(value) && !loss.includes(value)
  )

  return { win, loss, neutral }
}

export function getWinWeight(config: RunDiceConfig) {
  return config.win.reduce(
    (sum, value) => sum + WEIGHTS[value as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12],
    0
  )
}

export function getWinProbability(config: RunDiceConfig) {
  return getWinWeight(config) / TOTAL_WEIGHT
}

export function getPayoutMultiplier(config: RunDiceConfig) {
  const winProbability = getWinProbability(config)
  if (winProbability <= 0) return 0
  return Number((Math.max(1 / winProbability, 1.05) * 0.92).toFixed(2))
}

export function initRunDice(config?: RunDiceConfig): RunDiceState {
  const roundConfig = config ?? generateRunDiceConfig()
  return {
    stage: 'betting',
    config: roundConfig,
    betAmount: 0,
    rollCount: 0,
    rollResult: null,
    dice: null,
    payoutMultiplier: getPayoutMultiplier(roundConfig),
    outcome: null,
    message: 'Run Dice: bet, then roll with win/loss/neutral sums.',
  }
}

export function startRunDiceRound(amount: number, config: RunDiceConfig): RunDiceState {
  return {
    stage: 'inProgress',
    config,
    betAmount: amount,
    rollCount: 0,
    rollResult: null,
    dice: null,
    payoutMultiplier: getPayoutMultiplier(config),
    outcome: null,
    message: 'Roll the dice. Neutral rolls re-roll automatically up to 3 times.',
  }
}

export type RunDiceRollClass = 'win' | 'loss' | 'neutral'

export function classifyRunDiceTotal(config: RunDiceConfig, total: number): RunDiceRollClass {
  if (config.win.includes(total)) return 'win'
  if (config.loss.includes(total)) return 'loss'
  return 'neutral'
}

export interface RollRunDiceOptions {
  /** Survival perk: loss totals settle as push (bet returned). */
  lossProtection?: boolean
}

export function rollRunDice(state: RunDiceState, opts?: RollRunDiceOptions): RunDiceState {
  if (state.stage !== 'inProgress') return state
  const dice = randomRoll()
  const rollResult = dice[0] + dice[1]
  const rollClass = classifyRunDiceTotal(state.config, rollResult)
  const nextRollCount = state.rollCount + 1

  if (rollClass === 'win') {
    return {
      ...state,
      stage: 'settled',
      rollResult,
      dice,
      outcome: 'win',
      message: `Win on ${rollResult}.`,
    }
  }

  if (rollClass === 'loss') {
    if (opts?.lossProtection) {
      return {
        ...state,
        stage: 'settled',
        rollResult,
        dice,
        outcome: 'push',
        message: `Loss on ${rollResult} — protected push.`,
      }
    }
    return {
      ...state,
      stage: 'settled',
      rollResult,
      dice,
      outcome: 'loss',
      payoutMultiplier: 0,
      message: `Loss on ${rollResult}.`,
    }
  }

  if (nextRollCount >= 3) {
    return {
      ...state,
      stage: 'settled',
      rollResult,
      dice,
      rollCount: nextRollCount,
      outcome: 'push',
      message: `Push after ${nextRollCount} neutral rolls.`,
    }
  }

  return {
    ...state,
    rollCount: nextRollCount,
    rollResult,
    dice,
    message: `Neutral on ${rollResult}. Re-roll ${3 - nextRollCount} remaining.`,
  }
}

export function getRunDicePayout(state: RunDiceState) {
  if (state.outcome === 'win') return Math.round(state.betAmount * state.payoutMultiplier)
  if (state.outcome === 'push') return state.betAmount
  return 0
}
