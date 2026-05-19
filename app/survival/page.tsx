'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'
import { FloorCompleteModal } from '@/components/survival/floor-complete-modal'
import { SurvivalDefeatModal } from '@/components/survival/survival-defeat-modal'
import { MissionPanel } from '@/components/survival/mission-panel'
import { SurvivalShop } from '@/components/survival/survival-shop'

export default function SurvivalPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)

  useEffect(() => {
    if (!runActive && !lastRun) router.replace('/')
  }, [runActive, lastRun, router])

  if (!runActive) {
    return lastRun ? <RunSummary lastRun={lastRun} /> : null
  }

  const showHubPanels = !floorComplete && !runDefeated

  return (
    <>
      <FloorCompleteModal />
      <SurvivalDefeatModal />
      <div className="flex flex-col gap-6">
        <FloorPanel />
        <Lobby mode="survival" />

        {showHubPanels && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <SurvivalShop />
            </div>
            <MissionPanel />
          </div>
        )}
      </div>
    </>
  )
}
