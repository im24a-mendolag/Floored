import { createRng, seedFromString } from '@/utils/rng'
import { calcShopPrice } from './balance'
import { UPGRADES_CATALOG, type CatalogItem } from './upgrades-catalog'
import type { Difficulty, GameName } from '@/store/types'

export interface ShopOffer {
  item: CatalogItem
  price: number
}

function pickRandom<T>(pool: T[], rng: () => number, n: number): T[] {
  const copy = [...pool]
  const picked: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length)
    picked.push(copy.splice(idx, 1)[0]!)
  }
  return picked
}

/** Game-scope items for the current floor lobby (unowned). */
export function buildGameItemPool(floorGames: GameName[], ownedUpgradeIds: string[]): CatalogItem[] {
  const owned = new Set(ownedUpgradeIds)
  return UPGRADES_CATALOG.filter(
    (item) => item.scope === 'game' && item.game && floorGames.includes(item.game) && !owned.has(item.id),
  )
}

/** Run-wide items (unowned). */
export function buildRunItemPool(ownedUpgradeIds: string[]): CatalogItem[] {
  const owned = new Set(ownedUpgradeIds)
  return UPGRADES_CATALOG.filter((item) => item.scope === 'run' && !owned.has(item.id))
}

/** Legacy pool helper — used by the shop UI to check if rerolls are available. */
export function buildShopPool(floorGames: GameName[], ownedUpgradeIds: string[]): CatalogItem[] {
  return [
    ...buildGameItemPool(floorGames, ownedUpgradeIds),
    ...buildRunItemPool(ownedUpgradeIds),
  ]
}

/**
 * Always returns exactly: 2 game upgrades + 1 run upgrade.
 * A 4th active-item slot is reserved in the UI (not generated here).
 */
export function generateShopOffers(input: {
  runSeed: string
  floor: number
  difficulty: Difficulty
  floorGames: GameName[]
  ownedUpgradeIds?: string[]
  rerollCount?: number
  count?: number
}): ShopOffer[] {
  const rerollCount = input.rerollCount ?? 0
  const rng = createRng(seedFromString(`${input.runSeed}:shop:${input.floor}:${rerollCount}`))
  const owned = input.ownedUpgradeIds ?? []

  const gameItems = pickRandom(buildGameItemPool(input.floorGames, owned), rng, 2)
  const runItems  = pickRandom(buildRunItemPool(owned), rng, 1)

  return [...gameItems, ...runItems].map((item) => ({
    item,
    price: calcShopPrice(item.baseCost, input.difficulty),
  }))
}
