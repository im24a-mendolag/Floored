'use client'

import { useMemo } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { Button } from '@/components/ui/button'
import {
  generateShopOffersWithTicketRerolls,
  buildShopPool,
  SHOP_GAME_OFFER_COUNT,
  type ShopOffer,
} from '@/lib/survival/shop-offers'
import { getLobbyTicketCount, LOBBY_REROLL_TICKET_ID } from '@/lib/survival/lobby-ticket'
import {
  getCatalogItem,
  catalogScopeLabel,
  normalizeUpgradeId,
  type CatalogItem,
} from '@/lib/survival/upgrades-catalog'
import type { GameName } from '@/store/types'
import { formatChips } from '@/utils/format'
import { SurvivalSidebarPanel, SurvivalSidebarRow } from '@/components/survival/survival-sidebar-panel'

interface SurvivalShopProps {
  /** Hide title when embedded in floor-complete modal */
  embedded?: boolean
}

export function SurvivalShop({ embedded = false }: SurvivalShopProps) {
  const runSeed = useSurvivalStore((s) => s.runSeed)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const sparks = useSurvivalStore((s) => s.sparks)
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  const inventory = useSurvivalStore((s) => s.inventory)
  const shopRerollCount = useSurvivalStore((s) => s.shopRerollCount)
  const shopOfferTicketRerolls = useSurvivalStore((s) => s.shopOfferTicketRerolls)
  const purchaseUpgrade = useSurvivalStore((s) => s.purchaseUpgrade)
  const rerollShopOfferWithTicket = useSurvivalStore((s) => s.rerollShopOfferWithTicket)
  const lobbyTicketCount = getLobbyTicketCount(inventory)

  const ownedUpgradeIds = useMemo(
    () => purchasedUpgrades.map((u) => u.id),
    [purchasedUpgrades],
  )

  const offers = useMemo(() => {
    if (!runSeed || !difficulty) return []
    return generateShopOffersWithTicketRerolls({
      runSeed,
      floor: currentFloor,
      difficulty,
      floorGames,
      rerollCount: shopRerollCount,
      ownedUpgradeIds,
      slotTicketRerolls: shopOfferTicketRerolls,
    })
  }, [
    runSeed,
    currentFloor,
    difficulty,
    floorGames,
    shopRerollCount,
    ownedUpgradeIds,
    shopOfferTicketRerolls,
  ])

  const poolRemaining =
    difficulty != null ? buildShopPool(floorGames, ownedUpgradeIds).length : 0

  function isOwned(id: string, scope: string): boolean {
    if (scope === 'consumable') {
      return (inventory.find((i) => i.id === id)?.count ?? 0) > 0
    }
    return purchasedUpgrades.some((u) => normalizeUpgradeId(u.id) === id)
  }

  function ownedLabel(id: string, scope: string): string | null {
    if (scope === 'consumable') {
      const count = inventory.find((i) => i.id === id)?.count ?? 0
      return count > 0 ? `×${count}` : null
    }
    const owned = purchasedUpgrades.some((u) => normalizeUpgradeId(u.id) === id)
    if (!owned) return null
    const catalog = getCatalogItem(id)
    return catalog?.level != null ? `Owned · Lv.${catalog.level}` : 'Owned'
  }

  const runOffer = offers[SHOP_GAME_OFFER_COUNT] ?? null
  const gameOffers: (ShopOffer | null)[] = Array.from({ length: SHOP_GAME_OFFER_COUNT }, (_, i) =>
    offers[i] ?? null,
  )

  function renderOfferCard(offer: ShopOffer, slotIndex: number) {
    const { item, price } = offer
    const owned = isOwned(item.id, item.scope)
    const ownedText = ownedLabel(item.id, item.scope)
    const canAfford = sparks >= price
    const disabled = (item.scope !== 'consumable' && owned) || !canAfford
    const scopeLabel = catalogScopeLabel(item)
    const scopeTone =
      item.scope === 'game'
        ? 'text-sky-400/90'
        : item.scope === 'run'
          ? 'text-violet-400/80'
          : 'text-zinc-500'

    return (
      <div
        key={`${item.id}-${slotIndex}`}
        className="relative rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 flex flex-col gap-2"
      >
        {lobbyTicketCount > 0 && (
          <button
            type="button"
            title="Use a lobby reroll ticket on this offer"
            onClick={() => rerollShopOfferWithTicket(slotIndex)}
            className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/40 text-xs font-bold text-white/90 hover:bg-black/60"
          >
            ↻
          </button>
        )}
        <div className="flex items-start justify-between gap-2 pr-7">
          <div className="min-w-0">
            {scopeLabel && (
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${scopeTone}`}>
                {scopeLabel}
              </p>
            )}
            <p className="text-sm font-semibold text-zinc-200">{item.name}</p>
            {item.level != null && <p className="text-[10px] text-zinc-500">Level {item.level}</p>}
            {item.rarity && (
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">{item.rarity}</p>
            )}
          </div>
          <span className="text-sm font-bold text-amber-400 tabular-nums shrink-0">✦ {price}</span>
        </div>
        <p className="text-xs text-zinc-500 leading-snug">{item.description}</p>
        <Button
          size="sm"
          variant={ownedText ? 'secondary' : 'default'}
          disabled={disabled}
          className="w-full mt-auto"
          onClick={() => purchaseUpgrade(item.id, price)}
        >
          {ownedText ?? (canAfford ? 'Purchase' : 'Not enough sparks')}
        </Button>
      </div>
    )
  }

  function renderEmptyOfferSlot(label: string) {
    return (
      <div
        key={label}
        className="rounded-xl border border-dashed border-zinc-700/50 bg-zinc-950/20 p-3 flex flex-col gap-2 opacity-60 min-h-[8.5rem]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-zinc-600">
              {label}
            </p>
            <p className="text-sm font-semibold text-zinc-600">Empty</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-lg text-zinc-700 shrink-0">
            ∅
          </span>
        </div>
        <p className="text-xs text-zinc-700 leading-snug flex-1">No offer available this floor.</p>
        <button
          disabled
          className="w-full mt-auto rounded-md bg-zinc-900 text-zinc-700 text-xs py-1.5 cursor-not-allowed"
        >
          —
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 ${embedded ? '' : 'rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4'}`}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Shop</h3>
          <span className="text-sm font-bold text-amber-400 tabular-nums">
            <span className="text-[10px] font-normal text-zinc-500 mr-1">Sparks:</span>✦ {formatChips(sparks)}
          </span>
        </div>
      )}

      <p className="text-[10px] text-zinc-600 leading-snug">
        Game upgrades match this floor&apos;s lobby only. Lobby reroll tickets work on ↻ here too, and on missions.
        {shopRerollCount > 0 && ` · Rerolled ${shopRerollCount}× this floor`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {runOffer
          ? renderOfferCard(runOffer, SHOP_GAME_OFFER_COUNT)
          : renderEmptyOfferSlot('Run upgrade')}

        {/* Active item slot — coming soon */}
        <div className="rounded-xl border border-dashed border-zinc-700/40 bg-zinc-950/30 p-3 flex flex-col gap-2 opacity-50 min-h-[8.5rem]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-orange-400/80">Active</p>
              <p className="text-sm font-semibold text-zinc-500">Coming Soon</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-lg text-zinc-600 shrink-0">
              ∅
            </span>
          </div>
          <p className="text-xs text-zinc-600 leading-snug flex-1">Active items with on-use effects.</p>
          <button disabled className="w-full mt-auto rounded-md bg-zinc-800 text-zinc-600 text-xs py-1.5 cursor-not-allowed">
            Locked
          </button>
        </div>

        {gameOffers.map((offer, i) =>
          offer ? renderOfferCard(offer, i) : renderEmptyOfferSlot(`Game upgrade ${i + 1}`),
        )}
      </div>

      {offers.length === 0 && poolRemaining === 0 && (
        <p className="text-xs text-zinc-500 text-center py-2">
          No shop items left for this floor — try next floor or reroll after purchases.
        </p>
      )}
    </div>
  )
}

/** Compact list of owned run upgrades for game sidebar */
export function OwnedUpgradesList({
  compact = false,
  currentGame,
}: {
  compact?: boolean
  /** When set, run-wide + this game's items show in a pinned Active section. */
  currentGame?: GameName
}) {
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  const inventory = useSurvivalStore((s) => s.inventory)

  const ownedItems = purchasedUpgrades
    .map((u) => getCatalogItem(u.id))
    .filter((i): i is CatalogItem => i != null && i.scope !== 'consumable')

  const consumables = inventory
    .filter((c) => c.count > 0 && c.id !== LOBBY_REROLL_TICKET_ID)
    .map((c) => ({ ...c, item: getCatalogItem(c.id) }))
    .filter((c) => c.item)

  const totalCount = ownedItems.length + consumables.length

  if (totalCount === 0) {
    return (
      <SurvivalSidebarPanel compact={compact} title="Upgrades" count={0} empty emptyLabel="No upgrades yet" />
    )
  }

  const sortedItems =
    currentGame != null
      ? [
          ...ownedItems.filter((i) => i.scope === 'run' || i.game === currentGame),
          ...ownedItems.filter((i) => i.scope !== 'run' && i.game !== currentGame),
        ]
      : ownedItems

  return (
    <SurvivalSidebarPanel compact={compact} title="Upgrades" count={totalCount}>
      {sortedItems.map((item) => (
        <SurvivalSidebarRow key={item.id} name={item.name} scope={catalogScopeLabel(item)} />
      ))}
      {consumables.map(({ id, count, item }) => (
        <SurvivalSidebarRow key={id} name={`${item!.name} ×${count}`} scope="Ticket" />
      ))}
    </SurvivalSidebarPanel>
  )
}
