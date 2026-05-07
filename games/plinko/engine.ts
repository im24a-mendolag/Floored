import type { PlinkoState } from './types'

const SLOTS = [0, 0.5, 1, 2, 4, 8, 0] as const
const ROWS = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function generatePath() {
  let current = 3
  const path: number[] = [current]

  for (let i = 0; i < ROWS; i += 1) {
    const direction = Math.random() < 0.5 ? -1 : 1
    current = clamp(current + direction, 0, SLOTS.length - 1)
    path.push(current)
  }

  return path
}

export function initPlinko(): PlinkoState {
  return {
    stage: 'betting',
    betAmount: 0,
    path: [],
    finalSlot: null,
    payoutMultiplier: 0,
    outcome: null,
    message: 'Place your bet, then drop the puck through the Plinko board.',
  }
}

export function startPlinkoRound(amount: number): PlinkoState {
  return {
    stage: 'inProgress',
    betAmount: amount,
    path: [],
    finalSlot: null,
    payoutMultiplier: 0,
    outcome: null,
    message: 'Drop the puck and see which slot it lands in.',
  }
}

export function resolvePlinkoRound(state: PlinkoState): PlinkoState {
  if (state.stage !== 'inProgress') return state

  const path = generatePath()
  const finalSlot = path[path.length - 1] ?? 0
  const payoutMultiplier = SLOTS[finalSlot as number] ?? 0
  const endpoint = payoutMultiplier > 1 ? 'win' : payoutMultiplier === 1 ? 'push' : 'loss'

  return {
    ...state,
    stage: 'settled',
    path,
    finalSlot,
    payoutMultiplier,
    outcome: endpoint,
    message:
      endpoint === 'win'
        ? `Landed in slot ${finalSlot} for ${payoutMultiplier}x!`
        : endpoint === 'push'
        ? 'Landed in the safe zone. Your bet is returned.'
        : `Missed the payout slot and lost your bet.`,
  }
}

export function getPlinkoPayout(state: PlinkoState) {
  if (state.outcome === 'win') return Math.round(state.betAmount * state.payoutMultiplier)
  if (state.outcome === 'push') return state.betAmount
  return 0
}

export function getSlotMultipliers() {
  return SLOTS
}
