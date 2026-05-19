'use client'

import { useMemo } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { Button } from '@/components/ui/button'
import { generateShopOffers, buildShopPool } from '@/lib/survival/shop-offers'
import {
  getCatalogItem,
  catalogScopeLabel,
  formatGameLabel,
  type CatalogItem,
} from '@/lib/survival/upgrades-catalog'
import type { GameName } from '@/store/types'
import { calcShopRerollCost } from '@/lib/survival/balance'

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
  const purchaseUpgrade = useSurvivalStore((s) => s.purchaseUpgrade)
  const rerollShop = useSurvivalStore((s) => s.rerollShop)

  const ownedUpgradeIds = useMemo(
    () => purchasedUpgrades.map((u) => u.id),
    [purchasedUpgrades],
  )

  const offers = useMemo(() => {
    if (!runSeed || !difficulty) return []
    return generateShopOffers({
      runSeed,
      floor: currentFloor,
      difficulty,
      floorGames,
      ownedUpgradeIds,
      rerollCount: shopRerollCount,
      count: 4,
    })
  }, [runSeed, currentFloor, difficulty, floorGames, ownedUpgradeIds, shopRerollCount])

  const rerollCost = difficulty != null ? calcShopRerollCost(shopRerollCount, difficulty) : 0
  const poolRemaining =
    difficulty != null ? buildShopPool(floorGames, ownedUpgradeIds).length : 0
  const canRerollShop = poolRemaining > 0 && sparks >= rerollCost

  function isOwned(id: string, scope: string): boolean {
    if (scope === 'consumable') {
      return (inventory.find((i) => i.id === id)?.count ?? 0) > 0
    }
    return purchasedUpgrades.some((u) => u.id === id)
  }

  function ownedLabel(id: string, scope: string): string | null {
    if (scope === 'consumable') {
      const count = inventory.find((i) => i.id === id)?.count ?? 0
      return count > 0 ? `×${count}` : null
    }
    return purchasedUpgrades.some((u) => u.id === id) ? 'Owned' : null
  }

  return (
    <div className={`flex flex-col gap-3 ${embedded ? '' : 'rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4'}`}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Shop</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canRerollShop}
              className="h-7 text-[11px] px-2 border-zinc-700"
              onClick={() => rerollShop()}
            >
              Reroll ✦ {rerollCost}
            </Button>
            <span className="text-sm font-bold text-amber-400 tabular-nums">✦ {sparks.toLocaleString()}</span>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-600 leading-snug">
        Game upgrades match this floor&apos;s lobby only.
        {shopRerollCount > 0 && ` · Rerolled ${shopRerollCount}× this floor`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {offers.map(({ item, price }) => {
          const owned = isOwned(item.id, item.scope)
          const ownedText = ownedLabel(item.id, item.scope)
          const canAfford = sparks >= price
          const disabled = (item.scope !== 'consumable' && owned) || !canAfford
          const scopeLabel = catalogScopeLabel(item)

          return (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {scopeLabel && (
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                        item.scope === 'game'
                          ? 'text-sky-400/90'
                          : item.scope === 'run'
                            ? 'text-violet-400/80'
                            : 'text-zinc-500'
                      }`}
                    >
                      {scopeLabel}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-zinc-200">{item.name}</p>
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
        })}
      </div>

      {offers.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-4">
          {poolRemaining === 0
            ? 'No shop items left for this floor — try next floor or reroll after purchases.'
            : 'Shop unavailable — start a run first.'}
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
    .filter((c) => c.count > 0)
    .map((c) => ({ ...c, item: getCatalogItem(c.id) }))
    .filter((c) => c.item)

  const totalCount = ownedItems.length + consumables.length

  const activeItems =
    currentGame != null
      ? ownedItems.filter((i) => i.scope === 'run' || i.game === currentGame)
      : []
  const activeIds = new Set(activeItems.map((i) => i.id))
  const otherItems = currentGame != null ? ownedItems.filter((i) => !activeIds.has(i.id)) : ownedItems

  if (totalCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/40 p-2 flex items-center justify-center shrink-0">
        <span className="text-[10px] text-zinc-600">No upgrades yet</span>
      </div>
    )
  }

  const scrollClass = compact ? 'max-h-32' : 'max-h-48'

  function renderRow(item: CatalogItem) {
    const scope = catalogScopeLabel(item)
    return (
      <div key={item.id} className="flex flex-col gap-0.5 py-0.5">
        <p className="text-[11px] text-zinc-300 leading-snug">{item.name}</p>
        {scope && (
          <p className="text-[9px] text-zinc-600 uppercase tracking-wide leading-none">{scope}</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 flex flex-col gap-1.5 min-h-0 shrink">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
        Upgrades
        <span className="text-zinc-600 font-normal normal-case tracking-normal"> ({totalCount})</span>
      </p>

      {currentGame != null && activeItems.length > 0 && (
        <div className="shrink-0 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-2 py-1.5 flex flex-col gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-500/90">
            Active · {formatGameLabel(currentGame)}
          </p>
          {activeItems.map(renderRow)}
        </div>
      )}

      {(otherItems.length > 0 || consumables.length > 0) && (
        <div
          className={`overflow-y-auto overscroll-contain min-h-0 ${scrollClass} flex flex-col gap-1 pr-0.5`}
        >
          {currentGame != null && otherItems.length > 0 && (
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 sticky top-0 bg-zinc-900/95 py-0.5">
              All owned
            </p>
          )}
          {otherItems.map(renderRow)}
          {consumables.map(({ id, count, item }) => (
            <div key={id} className="flex flex-col gap-0.5 py-0.5">
              <p className="text-[11px] text-zinc-300 leading-snug">
                {item!.name} ×{count}
              </p>
              <p className="text-[9px] text-zinc-600 uppercase tracking-wide leading-none">Ticket</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
