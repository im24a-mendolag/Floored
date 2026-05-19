import type { MineTile, MinesState } from './types'

const DIFFICULTY_MINES: Record<MinesState['difficulty'], number> = {
  easy: 3,
  medium: 7,
  hard: 13,
  insane: 20,
}

function randomTiles(count: number, total: number) {
  const indices = new Set<number>()
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * total))
  }
  return indices
}

function buildTiles(mines: number) {
  const mineIndices = randomTiles(mines, 25)
  return Array.from({ length: 25 }, (_, index) => ({
    id: index,
    hasMine: mineIndices.has(index),
    revealed: false,
  }))
}

export function initMines() {
  return {
    stage: 'betting' as const,
    difficulty: 'easy' as const,
    betAmount: 0,
    tiles: [] as MineTile[],
    remainingSafe: 22,
    multiplier: 1,
    outcome: null as null,
    message: 'Choose difficulty and place your bet.',
  }
}

export function startMinesRound(amount: number, difficulty: MinesState['difficulty']): MinesState {
  const totalMines = DIFFICULTY_MINES[difficulty]
  const safeCount = 25 - totalMines
  return {
    stage: 'inProgress',
    difficulty,
    betAmount: amount,
    tiles: buildTiles(totalMines),
    remainingSafe: safeCount,
    multiplier: 1,
    outcome: null,
    message: `Find safe tiles. ${safeCount} safe squares remain.`,
  }
}

export function revealSafeMineTile(state: MinesState, tileId: number): MinesState {
  const tile = state.tiles.find((t) => t.id === tileId)
  if (!tile || tile.revealed || tile.hasMine) return state
  return {
    ...state,
    tiles: state.tiles.map((t) => (t.id === tileId ? { ...t, revealed: true } : t)),
    message: state.message,
  }
}

export function revealMineTile(state: MinesState, tileId: number): MinesState {
  if (state.stage !== 'inProgress') return state
  const tile = state.tiles.find((tile) => tile.id === tileId)
  if (!tile || tile.revealed) return state

  const nextTiles = state.tiles.map((t) =>
    t.id === tileId ? { ...t, revealed: true } : t
  )

  if (tile.hasMine) {
    return {
      ...state,
      stage: 'settled',
      tiles: nextTiles,
      multiplier: 0,
      outcome: 'loss',
      message: 'Boom! You hit a mine.',
    }
  }

  const nextRemainingSafe = state.remainingSafe - 1
  const nextMultiplier = Number(
    (state.multiplier * (25 / (nextRemainingSafe + 1))).toFixed(2)
  )

  return {
    ...state,
    tiles: nextTiles,
    remainingSafe: nextRemainingSafe,
    multiplier: nextMultiplier,
    message: `${nextRemainingSafe} safe squares left.`,
  }
}

export function cashOutMines(state: MinesState): MinesState {
  if (state.stage !== 'inProgress') return state
  return {
    ...state,
    stage: 'settled',
    outcome: 'win',
    message: `Cashed out at ${state.multiplier.toFixed(2)}×.`,
  }
}

export function getMinesPayout(state: MinesState) {
  return state.outcome === 'win' ? Math.round(state.betAmount * state.multiplier) : 0
}

/** Cursed reveal: the clicked tile is always a mine, regardless of placement. */
export function loseGame(state: MinesState, tileId: number): MinesState {
  if (state.stage !== 'inProgress') return state
  const tile = state.tiles.find((t) => t.id === tileId)
  if (!tile || tile.revealed) return state
  return {
    ...state,
    stage: 'settled',
    tiles: state.tiles.map((t) =>
      t.id === tileId ? { ...t, hasMine: true, revealed: true } : t,
    ),
    multiplier: 0,
    outcome: 'loss',
    message: 'Boom! You hit a mine.',
  }
}
