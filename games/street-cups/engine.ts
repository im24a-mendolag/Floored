import type { CupSwap, StreetCupsState } from './types'

function generateSwaps(count: number): CupSwap[] {
  const swaps: CupSwap[] = []
  for (let i = 0; i < count; i++) {
    const a = Math.floor(Math.random() * 3)
    let b = Math.floor(Math.random() * 2)
    if (b >= a) b++
    swaps.push({ a, b })
  }
  return swaps
}

export function initStreetCups(): StreetCupsState {
  return {
    betAmount: 0,
    stage: 'betting',
    revealSlot: null,
    shuffleSwaps: [],
    winningSlot: null,
    playerPick: null,
    outcome: null,
    message: 'Place your bet.',
  }
}

export function startStreetCups(betAmount: number): StreetCupsState {
  return {
    betAmount,
    stage: 'revealing',
    revealSlot: Math.floor(Math.random() * 3),
    shuffleSwaps: generateSwaps(12),
    winningSlot: null,
    playerPick: null,
    outcome: null,
    message: 'Watch carefully…',
  }
}

export function endShuffleStreetCups(state: StreetCupsState): StreetCupsState {
  return {
    ...state,
    stage: 'picking',
    winningSlot: Math.floor(Math.random() * 3),
    message: 'Pick a cup.',
  }
}

export function pickCupStreetCups(state: StreetCupsState, pickedSlot: number): StreetCupsState {
  const outcome = pickedSlot === state.winningSlot ? 'win' : 'loss'
  return {
    ...state,
    playerPick: pickedSlot,
    outcome,
    stage: 'settled',
    message: outcome === 'win' ? 'You found the crown!' : 'Wrong cup!',
  }
}

/** Win pays 2× the bet. */
export const STREET_CUPS_WIN_MULTIPLIER = 2
