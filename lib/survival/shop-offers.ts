import { createRng, seedFromString } from '@/utils/rng'
import { calcShopPrice } from './balance'
import { UPGRADES_CATALOG, type CatalogItem } from './upgrades-catalog'
import { isUpgradeOfferable } from './upgrade-levels'
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

function filterOfferable(items: CatalogItem[], ownedUpgradeIds: string[]): CatalogItem[] {
  return items.filter((item) => isUpgradeOfferable(item, ownedUpgradeIds))
}

/** Game-scope items for the current floor lobby (next level only). */
export function buildGameItemPool(floorGames: GameName[], ownedUpgradeIds: string[]): CatalogItem[] {
  return filterOfferable(
    UPGRADES_CATALOG.filter(
      (item) => item.scope === 'game' && item.game && floorGames.includes(item.game),
    ),
    ownedUpgradeIds,
  )
}

/** Run-wide items (next level only). */
export function buildRunItemPool(ownedUpgradeIds: string[]): CatalogItem[] {
  return filterOfferable(
    UPGRADES_CATALOG.filter((item) => item.scope === 'run'),
    ownedUpgradeIds,
  )
}

export function buildShopPool(floorGames: GameName[], ownedUpgradeIds: string[]): CatalogItem[] {
  return [
    ...buildGameItemPool(floorGames, ownedUpgradeIds),
    ...buildRunItemPool(ownedUpgradeIds),
  ]
}

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
  const runItems = pickRandom(buildRunItemPool(owned), rng, 1)

  return [...gameItems, ...runItems].map((item) => ({
    item,
    price: calcShopPrice(item.baseCost, input.difficulty),
  }))
}
