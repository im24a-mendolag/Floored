export type CaseRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface CaseItem {
  name: string
  icon: string
  value: number
  rarity: CaseRarity
}

export interface CaseDef {
  id: number
  name: string
  price: number
  emoji: string
  colorHex: string
  items: Array<{ item: CaseItem; weight: number }>
}

export interface OpenedCase {
  caseId: number
  item: CaseItem
}

export type CaseBattleStage = 'setup' | 'opening' | 'settled'

export interface CaseBattleState {
  stage: CaseBattleStage
  selectedCases: number[]
  totalCost: number
  userItems: OpenedCase[]
  botItems: OpenedCase[]
  userTotal: number
  botTotal: number
  outcome: 'win' | 'loss' | 'push' | null
  message: string
}
