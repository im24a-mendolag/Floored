import type { ChickenRaceState } from './types'

export interface Chicken {
  id: number
  name: string
  color: string  // hex color used via inline style
}

export const CHICKENS: Chicken[] = [
  { id: 0, name: 'Nugget',   color: '#ef4444' },
  { id: 1, name: 'Clucky',   color: '#3b82f6' },
  { id: 2, name: 'Feathers', color: '#10b981' },
  { id: 3, name: 'Goldie',   color: '#eab308' },
]

export const PAYOUT_MULTIPLIER = 3.60
const WIN_PROB = 1 / CHICKENS.length  // equal 25% each

function pickWinner(): number {
  return Math.floor(Math.random() * CHICKENS.length)
}

export function initChickenRace(): ChickenRaceState {
  return {
    stage: 'betting',
    betAmount: 0,
    pickedChicken: null,
    winner: null,
    outcome: null,
    message: 'Pick a chicken and place your bet.',
  }
}

export function startRace(bet: number, picked: number): ChickenRaceState {
  return {
    stage: 'racing',
    betAmount: bet,
    pickedChicken: picked,
    winner: pickWinner(),
    outcome: null,
    message: "And they're off!",
  }
}

export function settleRace(state: ChickenRaceState): ChickenRaceState {
  const won = state.pickedChicken === state.winner
  const winner = CHICKENS[state.winner!]!
  return {
    ...state,
    stage: 'settled',
    outcome: won ? 'win' : 'loss',
    message: won
      ? `${winner.name} wins! ${PAYOUT_MULTIPLIER}×`
      : `${winner.name} wins. Better luck next time.`,
  }
}

export const RACE_TICKS = 36
export const TICK_MS = 90

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function generateRaceFrames(winner: number): number[][] {
  const targets = CHICKENS.map((_, i) => i === winner ? 100 : 44 + Math.random() * 34)
  // Each chicken has a slight phase offset so they don't all move in lockstep
  const phases = CHICKENS.map(() => (Math.random() - 0.5) * 0.18)

  const raw: number[][] = Array.from({ length: RACE_TICKS }, (_, f) => {
    const t = (f + 1) / RACE_TICKS
    return targets.map((target, i) => {
      const shifted = Math.max(0, Math.min(1, t + phases[i]!))
      return target * easeInOutCubic(shifted)
    })
  })

  // Guarantee monotonic increase — no backward movement ever
  for (let f = 1; f < RACE_TICKS; f++) {
    for (let c = 0; c < CHICKENS.length; c++) {
      raw[f]![c] = Math.max(raw[f - 1]![c]!, raw[f]![c]!)
    }
  }

  // Final frame snapped to exact targets
  raw[RACE_TICKS - 1] = [...targets]

  return raw
}
