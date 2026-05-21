import { createRng, seedFromString } from '@/utils/rng'
import { calcShopPrice } from './balance'
import {
  UPGRADES_CATALOG,
  getCatalogItem,
  type CatalogItem,
  isUpgradeOfferable,
} from './upgrades-catalog'
import type { Difficulty, GameName } from '@/store/types'

export interface ShopOffer {
  item: CatalogItem
  price: number
}

/** Shared pool kinds — each has one pool array and one or more slots that draw from it. */
export type ShopPoolKind = 'game' | 'run' | 'active'

export const SHOP_GAME_OFFER_COUNT = 2
export const SHOP_RUN_OFFER_COUNT = 1
export const SHOP_ACTIVE_OFFER_COUNT = 1

export const SHOP_SLOT_GAME_0 = 0
export const SHOP_SLOT_GAME_1 = 1
export const SHOP_SLOT_RUN = 2
export const SHOP_SLOT_ACTIVE = 3
export const SHOP_SLOT_COUNT = 4

/** @deprecated Use SHOP_SLOT_COUNT — legacy count of non-active product slots. */
export const SHOP_OFFER_COUNT = SHOP_GAME_OFFER_COUNT + SHOP_RUN_OFFER_COUNT

export const EMPTY_SHOP_SLOT_ITEM_IDS: (string | null)[] = [null, null, null, null]

export interface ShopPools {
  game: string[]
  run: string[]
  active: string[]
}

/** Item ids already offered this floor per pool kind (never offered again until next floor). */
export interface ShopOfferedIds {
  game: string[]
  run: string[]
  active: string[]
}

export const EMPTY_SHOP_OFFERED_IDS: ShopOfferedIds = { game: [], run: [], active: [] }

export interface ShopFloorOffers {
  slotItemIds: (string | null)[]
  offeredIds: ShopOfferedIds
}

export function shopPoolKindForSlot(slotIndex: number): ShopPoolKind {
  if (slotIndex === SHOP_SLOT_GAME_0 || slotIndex === SHOP_SLOT_GAME_1) return 'game'
  if (slotIndex === SHOP_SLOT_RUN) return 'run'
  return 'active'
}

export function shopSlotIndicesForKind(kind: ShopPoolKind): number[] {
  switch (kind) {
    case 'game':
      return [SHOP_SLOT_GAME_0, SHOP_SLOT_GAME_1]
    case 'run':
      return [SHOP_SLOT_RUN]
    case 'active':
      return [SHOP_SLOT_ACTIVE]
  }
}

function filterOfferableIds(items: CatalogItem[], ownedUpgradeIds: string[]): string[] {
  return items.filter((item) => isUpgradeOfferable(item, ownedUpgradeIds)).map((item) => item.id)
}

/** All offerable game-upgrade ids for this floor (shared by both game slots). */
export function buildGameShopPool(floorGames: GameName[], ownedUpgradeIds: string[]): string[] {
  return filterOfferableIds(
    UPGRADES_CATALOG.filter(
      (item) => item.scope === 'game' && item.game && floorGames.includes(item.game),
    ),
    ownedUpgradeIds,
  )
}

/** All offerable run-upgrade ids (shared by the run slot). */
export function buildRunShopPool(ownedUpgradeIds: string[]): string[] {
  return filterOfferableIds(
    UPGRADES_CATALOG.filter((item) => item.scope === 'run'),
    ownedUpgradeIds,
  )
}

/** All offerable active/consumable ids (shared by the active slot). */
export function buildActiveShopPool(ownedUpgradeIds: string[]): string[] {
  return filterOfferableIds(
    UPGRADES_CATALOG.filter((item) => item.scope === 'consumable'),
    ownedUpgradeIds,
  )
}

export function getShopPools(floorGames: GameName[], ownedUpgradeIds: string[]): ShopPools {
  return {
    game: buildGameShopPool(floorGames, ownedUpgradeIds),
    run: buildRunShopPool(ownedUpgradeIds),
    active: buildActiveShopPool(ownedUpgradeIds),
  }
}

/** @deprecated Use getShopPools().game */
export function buildShopPool(floorGames: GameName[], ownedUpgradeIds: string[]): string[] {
  const pools = getShopPools(floorGames, ownedUpgradeIds)
  return [...pools.game, ...pools.run, ...pools.active]
}

function poolForKind(pools: ShopPools, kind: ShopPoolKind): string[] {
  return pools[kind]
}

function pickUniqueFromPool(
  pool: string[],
  count: number,
  rng: () => number,
  reserved: Set<string>,
): (string | null)[] {
  const slots: (string | null)[] = []
  const used = new Set(reserved)
  for (let i = 0; i < count; i++) {
    const available = pool.filter((id) => !used.has(id))
    if (available.length === 0) {
      slots.push(null)
      continue
    }
    const id = available[Math.floor(rng() * available.length)]!
    slots.push(id)
    used.add(id)
  }
  return slots
}

function offeredSetForKind(offeredIds: ShopOfferedIds, kind: ShopPoolKind): Set<string> {
  return new Set(offeredIds[kind])
}

function recordOfferedIds(
  offeredIds: ShopOfferedIds,
  kind: ShopPoolKind,
  ids: Iterable<string | null>,
): ShopOfferedIds {
  const next = new Set(offeredIds[kind])
  for (const id of ids) {
    if (id) next.add(id)
  }
  return { ...offeredIds, [kind]: [...next] }
}

/** Seed initial slots; every picked id is marked offered for its pool kind. */
export function rollInitialShopOffers(input: {
  runSeed: string
  floor: number
  rerollCount?: number
  floorGames: GameName[]
  ownedUpgradeIds: string[]
}): ShopFloorOffers {
  const rerollCount = input.rerollCount ?? 0
  const rng = createRng(
    seedFromString(`${input.runSeed}:shop-init:${input.floor}:${rerollCount}`),
  )
  const pools = getShopPools(input.floorGames, input.ownedUpgradeIds)
  let offeredIds: ShopOfferedIds = { game: [], run: [], active: [] }
  const used = new Set<string>()

  const game = pickUniqueFromPool(pools.game, SHOP_GAME_OFFER_COUNT, rng, used)
  game.forEach((id) => id && used.add(id))
  offeredIds = recordOfferedIds(offeredIds, 'game', game)

  const run = pickUniqueFromPool(pools.run, SHOP_RUN_OFFER_COUNT, rng, used)
  run.forEach((id) => id && used.add(id))
  offeredIds = recordOfferedIds(offeredIds, 'run', run)

  const active = pickUniqueFromPool(pools.active, SHOP_ACTIVE_OFFER_COUNT, rng, used)
  offeredIds = recordOfferedIds(offeredIds, 'active', active)

  return {
    slotItemIds: [...game, ...run, ...active],
    offeredIds,
  }
}

/** @deprecated Use rollInitialShopOffers().slotItemIds */
export function rollInitialShopSlotIds(
  input: Parameters<typeof rollInitialShopOffers>[0],
): (string | null)[] {
  return rollInitialShopOffers(input).slotItemIds
}

/** Pool ids not yet offered this floor in this kind (reroll candidates). */
export function availableIdsForShopSlot(
  slotIndex: number,
  _slotItemIds: (string | null)[],
  pools: ShopPools,
  offeredIds: ShopOfferedIds,
): string[] {
  const kind = shopPoolKindForSlot(slotIndex)
  const pool = poolForKind(pools, kind)
  const offered = offeredSetForKind(offeredIds, kind)
  return pool.filter((id) => !offered.has(id))
}

export function canRerollShopSlot(
  slotIndex: number,
  slotItemIds: (string | null)[],
  pools: ShopPools,
  offeredIds: ShopOfferedIds,
): boolean {
  return availableIdsForShopSlot(slotIndex, slotItemIds, pools, offeredIds).length > 0
}

/** When false, hide reroll on every slot in that kind (e.g. both game offers). */
export function canRerollShopKind(
  kind: ShopPoolKind,
  slotItemIds: (string | null)[],
  pools: ShopPools,
  offeredIds: ShopOfferedIds,
): boolean {
  return shopSlotIndicesForKind(kind).some((i) =>
    canRerollShopSlot(i, slotItemIds, pools, offeredIds),
  )
}

export function pickRerollForShopSlot(input: {
  runSeed: string
  floor: number
  slotIndex: number
  rollSeq: number
  slotItemIds: (string | null)[]
  pools: ShopPools
  offeredIds: ShopOfferedIds
}): string | null {
  const available = availableIdsForShopSlot(
    input.slotIndex,
    input.slotItemIds,
    input.pools,
    input.offeredIds,
  )
  if (available.length === 0) return null
  const rng = createRng(
    seedFromString(
      `${input.runSeed}:shop-ticket:${input.floor}:${input.slotIndex}:${input.rollSeq}`,
    ),
  )
  return available[Math.floor(rng() * available.length)]!
}

export function addOfferedId(
  offeredIds: ShopOfferedIds,
  kind: ShopPoolKind,
  id: string,
): ShopOfferedIds {
  return recordOfferedIds(offeredIds, kind, [id])
}

/** Rebuild offered ids from current slot assignments (migration / repair). */
export function offeredIdsFromSlots(slotItemIds: (string | null)[]): ShopOfferedIds {
  const offered: ShopOfferedIds = { game: [], run: [], active: [] }
  for (let i = 0; i < slotItemIds.length; i++) {
    const id = slotItemIds[i]
    if (!id) continue
    const kind = shopPoolKindForSlot(i)
    offered[kind] = [...new Set([...offered[kind], id])]
  }
  return offered
}

export function slotIdsToOffers(
  slotItemIds: (string | null)[],
  difficulty: Difficulty,
): (ShopOffer | null)[] {
  return slotItemIds.map((id) => {
    if (!id) return null
    const item = getCatalogItem(id)
    if (!item) return null
    return { item, price: calcShopPrice(item.baseCost, difficulty) }
  })
}
