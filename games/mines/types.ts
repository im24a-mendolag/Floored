export type MinesOutcome = 'win' | 'loss'

export interface MineTile {
  id: number
  hasMine: boolean
  revealed: boolean
}

export interface MinesState {
  stage: 'betting' | 'inProgress' | 'settled'
  difficulty: 'easy' | 'medium' | 'hard' | 'insane'
  betAmount: number
  tiles: MineTile[]
  remainingSafe: number
  multiplier: number
  outcome: MinesOutcome | null
  message: string
}
