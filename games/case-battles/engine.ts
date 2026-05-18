import type { CaseBattleState, CaseDef, CaseItem, OpenedCase } from './types'

export const CASES: CaseDef[] = [
  {
    id: 0, name: 'Bronze Case', price: 10, emoji: '📦', colorHex: '#b45309',
    items: [
      { item: { name: 'Worn Glove',   icon: '🧤', value: 2,  rarity: 'common'    }, weight: 30 },
      { item: { name: 'Cracked Lens', icon: '🔭', value: 6,  rarity: 'common'    }, weight: 28 },
      { item: { name: 'Steel Pipe',   icon: '🔧', value: 10, rarity: 'uncommon'  }, weight: 22 },
      { item: { name: 'Hunter Coat',  icon: '🧥', value: 16, rarity: 'rare'      }, weight: 12 },
      { item: { name: 'Shadow Fang',  icon: '🗡️', value: 30, rarity: 'epic'      }, weight: 6  },
      { item: { name: 'Cursed Relic', icon: '💀', value: 60, rarity: 'legendary' }, weight: 2  },
    ],
  },
  {
    id: 1, name: 'Silver Case', price: 25, emoji: '🗃️', colorHex: '#71717a',
    items: [
      { item: { name: 'Frayed Rope',   icon: '🪢', value: 5,   rarity: 'common'    }, weight: 30 },
      { item: { name: 'Basic Grenade', icon: '💥', value: 15,  rarity: 'common'    }, weight: 28 },
      { item: { name: 'Combat Knife',  icon: '🔪', value: 25,  rarity: 'uncommon'  }, weight: 22 },
      { item: { name: 'Tactical Vest', icon: '🦺', value: 40,  rarity: 'rare'      }, weight: 12 },
      { item: { name: 'Elite Scope',   icon: '🎯', value: 75,  rarity: 'epic'      }, weight: 6  },
      { item: { name: 'Phantom Blade', icon: '⚔️', value: 150, rarity: 'legendary' }, weight: 2  },
    ],
  },
  {
    id: 2, name: 'Gold Case', price: 100, emoji: '💼', colorHex: '#ca8a04',
    items: [
      { item: { name: 'Iron Shield',     icon: '🛡️', value: 20,  rarity: 'common'    }, weight: 30 },
      { item: { name: 'Precision Rifle', icon: '🔫', value: 60,  rarity: 'common'    }, weight: 28 },
      { item: { name: 'Battle Armor',    icon: '🪖', value: 100, rarity: 'uncommon'  }, weight: 22 },
      { item: { name: "Dragon's Eye",    icon: '👁️', value: 160, rarity: 'rare'      }, weight: 12 },
      { item: { name: 'Void Cannon',     icon: '💣', value: 300, rarity: 'epic'      }, weight: 6  },
      { item: { name: 'Mythic Greaves',  icon: '👟', value: 600, rarity: 'legendary' }, weight: 2  },
    ],
  },
  {
    id: 3, name: 'Diamond Case', price: 250, emoji: '💎', colorHex: '#22d3ee',
    items: [
      { item: { name: 'Dark Crystal',  icon: '🔷', value: 50,   rarity: 'common'    }, weight: 30 },
      { item: { name: 'Inferno Blade', icon: '🔥', value: 150,  rarity: 'common'    }, weight: 28 },
      { item: { name: 'War Machine',   icon: '⚙️', value: 250,  rarity: 'uncommon'  }, weight: 22 },
      { item: { name: 'Thunder Fist',  icon: '⚡', value: 400,  rarity: 'rare'      }, weight: 12 },
      { item: { name: 'Cosmic Dagger', icon: '🌙', value: 750,  rarity: 'epic'      }, weight: 6  },
      { item: { name: 'Eternal Aegis', icon: '🌀', value: 1500, rarity: 'legendary' }, weight: 2  },
    ],
  },
  {
    id: 4, name: 'Crown Case', price: 500, emoji: '👑', colorHex: '#a855f7',
    items: [
      { item: { name: 'Storm Rune',    icon: '🔮', value: 100,  rarity: 'common'    }, weight: 30 },
      { item: { name: 'Chaos Engine',  icon: '🌪️', value: 300,  rarity: 'common'    }, weight: 28 },
      { item: { name: 'Celestial Bow', icon: '🏹', value: 500,  rarity: 'uncommon'  }, weight: 22 },
      { item: { name: "God's Anvil",   icon: '⚒️', value: 800,  rarity: 'rare'      }, weight: 12 },
      { item: { name: 'Reality Shard', icon: '💫', value: 1500, rarity: 'epic'      }, weight: 6  },
      { item: { name: 'Omega Crown',   icon: '👑', value: 3000, rarity: 'legendary' }, weight: 2  },
    ],
  },
]

function rollItem(caseDef: CaseDef): CaseItem {
  const total = caseDef.items.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * total
  for (const entry of caseDef.items) {
    r -= entry.weight
    if (r <= 0) return entry.item
  }
  return caseDef.items[caseDef.items.length - 1]!.item
}

export function initCaseBattle(): CaseBattleState {
  return {
    stage: 'setup',
    selectedCases: [],
    totalCost: 0,
    userItems: [],
    botItems: [],
    userTotal: 0,
    botTotal: 0,
    outcome: null,
    message: 'Select up to 5 cases to battle.',
  }
}

function computeCost(ids: number[]): number {
  return ids.reduce((s, id) => s + (CASES[id]?.price ?? 0), 0)
}

export function addCase(state: CaseBattleState, caseId: number): CaseBattleState {
  if (state.selectedCases.length >= 5) return state
  const next = [...state.selectedCases, caseId]
  return { ...state, selectedCases: next, totalCost: computeCost(next) }
}

export function removeCase(state: CaseBattleState, caseId: number): CaseBattleState {
  const idx = state.selectedCases.lastIndexOf(caseId)
  if (idx === -1) return state
  const next = [...state.selectedCases]
  next.splice(idx, 1)
  return { ...state, selectedCases: next, totalCost: computeCost(next) }
}

export function startBattle(state: CaseBattleState): CaseBattleState {
  if (state.selectedCases.length === 0) return state

  const userItems: OpenedCase[] = state.selectedCases.map(caseId => ({
    caseId,
    item: rollItem(CASES[caseId]!),
  }))
  const botItems: OpenedCase[] = state.selectedCases.map(caseId => ({
    caseId,
    item: rollItem(CASES[caseId]!),
  }))

  return {
    ...state,
    stage: 'opening',
    userItems,
    botItems,
    userTotal: 0,
    botTotal: 0,
    outcome: null,
    message: 'Opening cases…',
  }
}

export function settleBattle(state: CaseBattleState): CaseBattleState {
  const userTotal = state.userItems.reduce((s, oc) => s + oc.item.value, 0)
  const botTotal  = state.botItems.reduce((s, oc) => s + oc.item.value, 0)
  const userWon   = userTotal > botTotal

  return {
    ...state,
    stage: 'settled',
    userTotal,
    botTotal,
    outcome: userWon ? 'win' : 'loss',
    message: userWon
      ? 'You win! Higher total value!'
      : userTotal === botTotal
        ? 'Tie — bot takes it!'
        : 'Bot wins! Better luck next time.',
  }
}
