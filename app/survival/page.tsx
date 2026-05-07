'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'

export default function SurvivalPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const lastRun = useSurvivalStore((s) => s.lastRun)

  useEffect(() => {
    if (!runActive && !lastRun) router.replace('/')
  }, [runActive, lastRun, router])

  if (!runActive) {
    return lastRun ? <RunSummary lastRun={lastRun} /> : null
  }

  return (
    <div className="flex flex-col gap-6">
      <FloorPanel />
      <Lobby mode="survival" />
    </div>
  )
}
