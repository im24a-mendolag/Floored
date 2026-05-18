import type { DragonTowerState, TileRow } from './types'

export const NUM_ROWS = 5
export const TILES_PER_ROW = 3

export const FLOOR_MULTIPLIERS = [1.40, 1.96, 2.74, 3.84, 5.38] as const

function randomRow(): TileRow {
  return {
    dragonAt: Math.floor(Math.random() * TILES_PER_ROW),
    picked: null,
    revealed: false,
  }
}

export function initDragonTower(): DragonTowerState {
  return {
    stage: 'betting',
    rows: Array.from({ length: NUM_ROWS }, randomRow),
    activeRow: 0,
    betAmount: 0,
    cashoutMultiplier: 0,
    outcome: null,
    message: 'Place your bet and start climbing.',
  }
}

export function startDragonTower(bet: number): DragonTowerState {
  return {
    stage: 'climbing',
    rows: Array.from({ length: NUM_ROWS }, randomRow),
    activeRow: 0,
    betAmount: bet,
    cashoutMultiplier: 0,
    outcome: null,
    message: 'Pick a tile on Floor 1.',
  }
}

export function pickTile(state: DragonTowerState, tileIdx: number): DragonTowerState {
  if (state.stage !== 'climbing') return state
  const { activeRow, rows } = state
  const row = rows[activeRow]
  if (!row || row.picked !== null) return state

  const isDragon = tileIdx === row.dragonAt
  const newRows = rows.map((r, i) =>
    i === activeRow ? { ...r, picked: tileIdx, revealed: isDragon } : r
  )

  if (isDragon) {
    return {
      ...state,
      stage: 'busted',
      rows: newRows.map(r => ({ ...r, revealed: true })),
      outcome: 'loss',
      message: 'Dragon! You were burned.',
    }
  }

  const nextRow = activeRow + 1
  const mult = FLOOR_MULTIPLIERS[activeRow]!

  if (nextRow >= NUM_ROWS) {
    return {
      ...state,
      stage: 'cashed-out',
      rows: newRows,
      activeRow: nextRow,
      cashoutMultiplier: mult,
      outcome: 'win',
      message: `Tower conquered! ${mult.toFixed(2)}×`,
    }
  }

  return {
    ...state,
    rows: newRows,
    activeRow: nextRow,
    cashoutMultiplier: mult,
    message: `Floor ${nextRow + 1} — climb higher or cash out.`,
  }
}

export function cashOut(state: DragonTowerState): DragonTowerState {
  if (state.stage !== 'climbing' || state.cashoutMultiplier <= 0) return state
  return {
    ...state,
    stage: 'cashed-out',
    outcome: 'win',
    message: `Cashed out at ${state.cashoutMultiplier.toFixed(2)}×`,
  }
}
