export type RaceStage = 'betting' | 'racing' | 'settled'

export interface ChickenRaceState {
  stage: RaceStage
  betAmount: number
  pickedChicken: number | null
  winner: number | null
  outcome: 'win' | 'loss' | null
  message: string
}
