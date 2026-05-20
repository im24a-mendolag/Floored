'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'
import { FloorCompleteModal } from '@/components/survival/floor-complete-modal'
import { SurvivalDefeatModal } from '@/components/survival/survival-defeat-modal'
import { MissionPanel } from '@/components/survival/mission-panel'
import { SurvivalShop } from '@/components/survival/survival-shop'
import { DifficultyDialog } from '@/components/difficulty-dialog'
import { Button } from '@/components/ui/button'
import { calcShopPrice } from '@/lib/survival/balance'
import {
  getLobbyTicketCount,
  LOBBY_REROLL_TICKET,
  LOBBY_REROLL_TICKET_RULES,
} from '@/lib/survival/lobby-ticket'

export default function SurvivalPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const sparks = useSurvivalStore((s) => s.sparks)
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const inventory = useSurvivalStore((s) => s.inventory)
  const purchaseLobbyRerollTicket = useSurvivalStore((s) => s.purchaseLobbyRerollTicket)

  const [difficultyOpen, setDifficultyOpen] = useState(!runActive)

  function handleDifficultyClose() {
    setDifficultyOpen(false)
    if (!useSurvivalStore.getState().runActive) router.replace('/')
  }

  if (!runActive) {
    return (
      <>
        <DifficultyDialog open={difficultyOpen} onClose={handleDifficultyClose} />
        {lastRun && <RunSummary lastRun={lastRun} />}
      </>
    )
  }

  const ticketCount = getLobbyTicketCount(inventory)
  const ticketPrice = difficulty ? calcShopPrice(LOBBY_REROLL_TICKET.baseCost, difficulty) : 0
  const canBuyTicket = difficulty != null && sparks >= ticketPrice
  const showHubPanels = !floorComplete && !runDefeated

  return (
    <>
      <FloorCompleteModal />
      <SurvivalDefeatModal />
      <div className="flex flex-col gap-3">
        <FloorPanel />
        <Lobby mode="survival" />

        {showHubPanels && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <SurvivalShop />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Lobby Reroll Tickets
                    </p>
                    <p className="text-sm font-bold text-zinc-200 tabular-nums mt-1">
                      {ticketCount}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canBuyTicket}
                    className="h-8 border-zinc-700 text-xs"
                    onClick={() => purchaseLobbyRerollTicket()}
                  >
                    Buy ticket
                    <span className="ml-1 font-bold text-amber-400 tabular-nums">✦ {ticketPrice}</span>
                  </Button>
                </div>
                <ul className="text-[10px] text-zinc-500 leading-snug mt-3 space-y-1 list-disc list-inside">
                  {LOBBY_REROLL_TICKET_RULES.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="flex-1">
                <MissionPanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
