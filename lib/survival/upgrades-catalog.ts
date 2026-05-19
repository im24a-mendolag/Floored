import { SURVIVAL_GAME_POOL } from './balance'
import { LOBBY_REROLL_TICKET, LOBBY_REROLL_TICKET_ID } from './lobby-ticket'
import { perkProcChancePercent } from './perk-proc'
import type { GameName, PurchasedUpgrade } from '@/store/types'

export type UpgradeScope = 'run' | 'game' | 'consumable'

export interface CatalogItem {
  id: string
  name: string
  description: string
  baseCost: number
  scope: UpgradeScope
  game?: GameName
  effectKey: string
  rarity?: 'common' | 'rare' | 'epic'
}

const GAME_BOOST_LABELS: Record<GameName, { name: string; description: string }> = {
  blackjack: { name: 'Card Counter', description: '+8% blackjack win payouts.' },
  crash: { name: 'Early Cashout', description: '+8% crash win payouts.' },
  plinko: { name: 'Gravity Bias', description: '+8% plinko win payouts.' },
  'over-under': { name: 'Loaded Dice', description: '+8% over/under win payouts.' },
  wheel: { name: 'Wheel Weight', description: '+8% wheel win payouts.' },
  'run-dice': { name: 'Hot Hand', description: '+8% run dice win payouts.' },
  mines: { name: 'Safe Step', description: '+8% mines cashout payouts.' },
  'chicken-road': { name: 'Feathered Path', description: '+8% chicken road win payouts.' },
  slots: { name: 'Jackpot Juice', description: '+8% slots win payouts.' },
  roulette: { name: 'Ball Magnet', description: '+8% roulette win payouts.' },
  'dragon-tower': { name: 'Dragon Sight', description: '+8% dragon tower cashout payouts.' },
  'chicken-race': { name: 'Race Analyst', description: '+8% chicken race win payouts.' },
  'street-cups': { name: 'Sharp Eyes', description: '+8% street cups win payouts.' },
  'case-battles': { name: 'Case Hunter', description: '+8% case battles win payouts.' },
  'poker-1p': { name: 'Poker Face', description: '+8% poker win payouts.' },
  hilo: { name: 'Ace Spotter', description: '+8% Hi-Lo win payouts.' },
  keno: { name: 'Lucky Grid', description: '+8% keno win payouts.' },
  'coin-flip': { name: 'Weighted Coin', description: '+8% coin flip win payouts.' },
}

const GAME_PERK_DEFS: Record<
  GameName,
  { name: string; description: string; effectKey: string; baseCost: number; rarity: 'rare' | 'epic' }
> = {
  blackjack: {
    name: 'Hole Card Reader',
    description: 'See the dealer’s hole card while you play your hand.',
    effectKey: 'perk_peek_dealer',
    baseCost: 24,
    rarity: 'epic',
  },
  hilo: {
    name: 'Range Finder',
    description: 'Shows the min–max value of the next card still in the deck.',
    effectKey: 'perk_hilo_range',
    baseCost: 20,
    rarity: 'rare',
  },
  'chicken-race': {
    name: 'Slow Scout',
    description: 'Cross out one chicken that will not win before the race.',
    effectKey: 'perk_chicken_scout',
    baseCost: 22,
    rarity: 'rare',
  },
  crash: {
    name: 'Crash Zone',
    description: 'Shows a narrow band around the hidden crash point.',
    effectKey: 'perk_crash_zone',
    baseCost: 22,
    rarity: 'rare',
  },
  mines: {
    name: 'Mine Sweeper',
    description: 'One safe tile is revealed when the round starts.',
    effectKey: 'perk_mines_safe',
    baseCost: 20,
    rarity: 'rare',
  },
  plinko: {
    name: 'First Ball Shield',
    description: 'When active, the first ball in a drop is refunded if it would lose money.',
    effectKey: 'perk_plinko_first_ball',
    baseCost: 18,
    rarity: 'rare',
  },
  'over-under': {
    name: 'Safe Opening Roll',
    description: 'When active, your first roll cannot lose money (refunded to a push).',
    effectKey: 'perk_over_under_shield',
    baseCost: 16,
    rarity: 'rare',
  },
  wheel: {
    name: 'Color Scout',
    description: 'When active, one losing color is crossed off before you spin.',
    effectKey: 'perk_wheel_scout',
    baseCost: 18,
    rarity: 'rare',
  },
  'run-dice': {
    name: 'Loaded Insight',
    description: 'Highlights your best winning face on the die.',
    effectKey: 'perk_run_dice_insight',
    baseCost: 16,
    rarity: 'rare',
  },
  'chicken-road': {
    name: 'Safe Lane',
    description: 'One safe lane is marked on each crossing row.',
    effectKey: 'perk_chicken_road_lane',
    baseCost: 20,
    rarity: 'rare',
  },
  slots: {
    name: 'First Spin Shield',
    description: 'When active, your first spin cannot lose money (refunded to a push).',
    effectKey: 'perk_slots_shield',
    baseCost: 18,
    rarity: 'rare',
  },
  roulette: {
    name: 'Ball Tracker',
    description: 'Three numbers that will not hit are crossed off the board.',
    effectKey: 'perk_roulette_tracker',
    baseCost: 22,
    rarity: 'epic',
  },
  'dragon-tower': {
    name: 'Dragon’s Blind Spot',
    description: 'One safe tile per row is marked before you pick.',
    effectKey: 'perk_dragon_blindspot',
    baseCost: 22,
    rarity: 'rare',
  },
  'street-cups': {
    name: 'Cup Truth',
    description: 'One empty cup is crossed off before you pick.',
    effectKey: 'perk_street_cups_truth',
    baseCost: 18,
    rarity: 'rare',
  },
  'case-battles': {
    name: 'Case X-Ray',
    description: 'See the value tier of one random case before opening.',
    effectKey: 'perk_case_xray',
    baseCost: 20,
    rarity: 'rare',
  },
  'poker-1p': {
    name: 'Hold Harmony',
    description: 'When active, the draw favors cards matching the ranks you held.',
    effectKey: 'perk_poker_hold_bias',
    baseCost: 20,
    rarity: 'rare',
  },
  keno: {
    name: 'Number Heat',
    description: 'Two numbers that will hit are highlighted before the draw.',
    effectKey: 'perk_keno_heat',
    baseCost: 22,
    rarity: 'epic',
  },
  'coin-flip': {
    name: 'Weighted Edge',
    description: 'Your chosen side has a 55% chance to win each flip.',
    effectKey: 'perk_coin_bias',
    baseCost: 20,
    rarity: 'rare',
  },
}

function gameBoostItems(): CatalogItem[] {
  return SURVIVAL_GAME_POOL.map((game) => {
    const label = GAME_BOOST_LABELS[game]
    return {
      id: `${game.replace(/-/g, '_')}_boost`,
      name: label.name,
      description: label.description,
      baseCost: 14,
      scope: 'game' as const,
      game,
      effectKey: 'payout_mult_1.08',
      rarity: 'common' as const,
    }
  })
}

function withProcNote(description: string, effectKey: string): string {
  const pct = perkProcChancePercent(effectKey)
  if (pct == null) return description
  return `${description} (~${pct}% chance to activate each bet.)`
}

function gamePerkItems(): CatalogItem[] {
  return SURVIVAL_GAME_POOL.map((game) => {
    const perk = GAME_PERK_DEFS[game]
    return {
      id: `${game.replace(/-/g, '_')}_perk`,
      name: perk.name,
      description: withProcNote(perk.description, perk.effectKey),
      baseCost: perk.baseCost,
      scope: 'game' as const,
      game,
      effectKey: perk.effectKey,
      rarity: perk.rarity,
    }
  })
}

export const UPGRADES_CATALOG: CatalogItem[] = [
  {
    id: 'payout_boost_5',
    name: 'Lucky Charm',
    description: '+5% payout on all wins for the rest of the run.',
    baseCost: 12,
    scope: 'run',
    effectKey: 'payout_mult_1.05',
    rarity: 'common',
  },
  {
    id: 'payout_boost_10',
    name: 'Golden Touch',
    description: '+10% payout on all wins for the rest of the run.',
    baseCost: 22,
    scope: 'run',
    effectKey: 'payout_mult_1.10',
    rarity: 'rare',
  },
  {
    id: 'streak_insurance',
    name: 'Streak Shield',
    description: 'First loss each floor does not reset your win streak.',
    baseCost: 18,
    scope: 'run',
    effectKey: 'streak_shield',
    rarity: 'rare',
  },
  {
    id: 'first_bet_insurance',
    name: 'Opening Ticket',
    description: 'First bet on each floor is free up to 10× the floor minimum bet. Excess is charged normally.',
    baseCost: 20,
    scope: 'run',
    effectKey: 'first_bet_free',
    rarity: 'rare',
  },
  ...gameBoostItems(),
  ...gamePerkItems(),
]

export function getCatalogItem(id: string): CatalogItem | undefined {
  if (id === LOBBY_REROLL_TICKET_ID) {
    return {
      id: LOBBY_REROLL_TICKET_ID,
      name: LOBBY_REROLL_TICKET.name,
      description: LOBBY_REROLL_TICKET.description,
      baseCost: LOBBY_REROLL_TICKET.baseCost,
      scope: 'consumable',
      effectKey: 'consumable_reroll',
      rarity: 'common',
    }
  }
  return UPGRADES_CATALOG.find((i) => i.id === id)
}

export function getCatalogItemByEffect(effectKey: string, game?: GameName): CatalogItem | undefined {
  return UPGRADES_CATALOG.find(
    (i) => i.effectKey === effectKey && (game == null || i.game === game || i.scope === 'run'),
  )
}

export function formatGameLabel(game: GameName): string {
  return game
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function catalogScopeLabel(item: CatalogItem): string | null {
  if (item.scope === 'game' && item.game) return formatGameLabel(item.game)
  if (item.scope === 'run') return 'All games'
  if (item.scope === 'consumable') return 'Consumable'
  return null
}

/** Boost + perk for one game (for reference / UI). */
export function getItemsForGame(game: GameName): CatalogItem[] {
  return UPGRADES_CATALOG.filter((i) => i.game === game)
}

/** All non-consumable catalog items as owned upgrades (dev/testing). */
export function allPurchasedUpgradesForDev(): PurchasedUpgrade[] {
  const purchasedAt = new Date().toISOString()
  return UPGRADES_CATALOG.filter((item) => item.scope !== 'consumable').map((item) => ({
    id: item.id,
    purchasedAt,
  }))
}
