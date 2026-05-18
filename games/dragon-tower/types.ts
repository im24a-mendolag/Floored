export type TowerStage = 'betting' | 'climbing' | 'cashed-out' | 'busted'

export interface TileRow {
  dragonAt: number
  picked: number | null
  revealed: boolean
}

export interface DragonTowerState {
  stage: TowerStage
  rows: TileRow[]
  activeRow: number
  betAmount: number
  cashoutMultiplier: number
  outcome: 'win' | 'loss' | null
  message: string
}
