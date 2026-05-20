import { createRng, seedFromString } from '@/utils/rng'
import { calcShopPrice } from './balance'
import { UPGRADES_CATALOG, type CatalogItem, isUpgradeOfferable } from './upgrades-catalog'
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

export const SHOP_GAME_OFFER_COUNT = 2
export const SHOP_RUN_OFFER_COUNT = 1
export const SHOP_OFFER_COUNT = SHOP_GAME_OFFER_COUNT + SHOP_RUN_OFFER_COUNT

export function generateShopOffers(input: {
  runSeed: string
  floor: number
  difficulty: Difficulty
  floorGames: GameName[]
  ownedUpgradeIds?: string[]
  rerollCount?: number
  purchaseCount?: number
  count?: number
}): ShopOffer[] {
  const rerollCount = input.rerollCount ?? 0
  const rng = createRng(seedFromString(`${input.runSeed}:shop:${input.floor}:${rerollCount}`))
  const owned = input.ownedUpgradeIds ?? []

  const gameItems = pickRandom(buildGameItemPool(input.floorGames, owned), rng, SHOP_GAME_OFFER_COUNT)
  const runItems = pickRandom(buildRunItemPool(owned), rng, SHOP_RUN_OFFER_COUNT)

  return [...gameItems, ...runItems].map((item) => ({
    item,
    price: calcShopPrice(item.baseCost, input.difficulty),
  }))
}

/** Reroll a single shop slot using a lobby reroll ticket (seeded per slot). */
export function rerollShopOfferAtSlot(input: {
  runSeed: string
  floor: number
  slotIndex: number
  slotRerollCount: number
  difficulty: Difficulty
  floorGames: GameName[]
  ownedUpgradeIds: string[]
  excludeItemIds: string[]
}): ShopOffer | null {
  const isRunSlot = input.slotIndex >= SHOP_GAME_OFFER_COUNT
  const pool = (
    isRunSlot
      ? buildRunItemPool(input.ownedUpgradeIds)
      : buildGameItemPool(input.floorGames, input.ownedUpgradeIds)
  ).filter((item) => !input.excludeItemIds.includes(item.id))
  if (pool.length === 0) return null

  const rng = createRng(
    seedFromString(
      `${input.runSeed}:shop-ticket:${input.floor}:${input.slotIndex}:${input.slotRerollCount}`,
    ),
  )
  const item = pool[Math.floor(rng() * pool.length)]!
  return { item, price: calcShopPrice(item.baseCost, input.difficulty) }
}

/** Base shop row plus per-slot replacements from lobby reroll tickets. */
export function generateShopOffersWithTicketRerolls(
  input: Parameters<typeof generateShopOffers>[0] & { slotTicketRerolls?: number[] },
): ShopOffer[] {
  const base = generateShopOffers({ ...input, purchaseCount: input.purchaseCount ?? 0 })
  const slotRerolls = input.slotTicketRerolls ?? []
  const owned = input.ownedUpgradeIds ?? []
  const result: ShopOffer[] = []

  for (let i = 0; i < base.length; i++) {
    const count = slotRerolls[i] ?? 0
    if (count === 0) {
      result.push(base[i]!)
      continue
    }
    const excludeItemIds = [
      base[i]!.item.id,
      ...result.map((o) => o.item.id),
      ...base.slice(i + 1).map((o) => o.item.id),
    ]
    const rerolled = rerollShopOfferAtSlot({
      runSeed: input.runSeed,
      floor: input.floor,
      slotIndex: i,
      slotRerollCount: count,
      difficulty: input.difficulty,
      floorGames: input.floorGames,
      ownedUpgradeIds: owned,
      excludeItemIds,
    })
    result.push(rerolled ?? base[i]!)
  }

  return result
}
