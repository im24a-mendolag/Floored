'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import type { GameName } from '@/store/types'
import { FloorCompleteModal } from '@/components/survival/floor-complete-modal'
import { SurvivalDefeatModal } from '@/components/survival/survival-defeat-modal'
import { MissionPanel } from '@/components/survival/mission-panel'
import { OwnedUpgradesList } from '@/components/survival/survival-shop'

function gameLabel(name: GameName): string {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function SurvivalGameWrapper({
  currentGame,
  children,
}: {
  currentGame: GameName
  children: ReactNode
}) {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorStartBankroll = useSurvivalStore((s) => s.floorStartBankroll)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const sparks = useSurvivalStore((s) => s.sparks)
  const openingBetFree = useOpeningTicketActive()
  const endlessMode = useSurvivalStore((s) => s.endlessMode)

  useEffect(() => {
    if (runActive) return
    router.replace(lastRun ? '/survival' : '/')
  }, [runActive, lastRun, router])

  if (!runActive) return null

  const otherGames = floorGames.filter((g) => g !== currentGame)

  return (
    <>
      <FloorCompleteModal />
      <SurvivalDefeatModal />
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Left sidebar — missions + upgrades */}
        <div className="hidden lg:flex flex-col gap-2 w-44 shrink-0 min-h-0 overflow-hidden">
          <MissionPanel compact />
          <OwnedUpgradesList compact currentGame={currentGame} />
        </div>

        {/* Center — game, completely unmodified */}
        <div className="flex flex-col flex-1 min-h-0">
          {children}
        </div>

        {/* Right sidebar — floor stats + quick links */}
        <div className="hidden lg:flex flex-col gap-3 w-48 shrink-0">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Floor</p>
              <p className="text-2xl font-black leading-tight">
                {currentFloor}
                <span className="text-sm font-normal text-muted-foreground">
                  {endlessMode ? ' ∞' : ' / 10'}
                </span>
              </p>
            </div>
            {openingBetFree && (
              <p className="text-[10px] font-semibold text-emerald-400/90 leading-tight">Opening Ticket ready</p>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Bankroll</p>
              <p className="text-lg font-black tabular-nums leading-tight">
                <span className={bankroll >= floorStartBankroll ? 'text-foreground' : 'text-red-400'}>
                  {formatChips(bankroll)}
                </span>
                <span className="text-sm font-normal text-muted-foreground"> / {formatChips(quotaTarget)}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Sparks</p>
              <p className="text-2xl font-black tabular-nums leading-tight text-amber-300">{sparks.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Min Bet</p>
              <p className="text-sm font-semibold text-muted-foreground leading-tight">{formatChips(floorMinBet)}</p>
            </div>
          </div>

          {otherGames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-1">Switch game</p>
              {otherGames.map((g) => (
                <Link
                  key={g}
                  href={`/survival/${g}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  {gameLabel(g)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
