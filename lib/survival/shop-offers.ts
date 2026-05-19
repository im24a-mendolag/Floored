import { createRng, seedFromString } from '@/utils/rng'
import { calcShopPrice } from './balance'
import { UPGRADES_CATALOG, type CatalogItem } from './upgrades-catalog'
import type { Difficulty, GameName } from '@/store/types'

export interface ShopOffer {
  item: CatalogItem
  price: number
}

/** Run-wide + consumables always eligible; game items only for current floor lobby. */
export function buildShopPool(floorGames: GameName[], ownedUpgradeIds: string[]): CatalogItem[] {
  const owned = new Set(ownedUpgradeIds)
  return UPGRADES_CATALOG.filter((item) => {
    if (item.scope === 'consumable') return false
    if (item.scope === 'game') {
      if (!item.game || !floorGames.includes(item.game)) return false
    }
    if (item.scope === 'run' || item.scope === 'game') {
      if (owned.has(item.id)) return false
    }
    return true
  })
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
  const count = input.count ?? 4
  const rerollCount = input.rerollCount ?? 0
  const rng = createRng(seedFromString(`${input.runSeed}:shop:${input.floor}:${rerollCount}`))
  const pool = buildShopPool(input.floorGames, input.ownedUpgradeIds ?? [])
  const offers: ShopOffer[] = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length)
    const item = pool.splice(idx, 1)[0]!
    offers.push({
      item,
      price: calcShopPrice(item.baseCost, input.difficulty),
    })
  }

  return offers
}
