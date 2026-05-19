'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'
import { FloorCompleteModal } from '@/components/survival/floor-complete-modal'

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
    <>
      <FloorCompleteModal />
      <div className="flex flex-col gap-6">
        <FloorPanel />
        <Lobby mode="survival" />

        {/* Shop + Missions placeholders */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Shop — 2×2 */}
          <div className="col-span-2 h-[268px] rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-zinc-600">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-none stroke-current stroke-[1.5]" aria-hidden>
              <path d="M3 9h18M9 9V6a3 3 0 0 1 6 0v3M6 9l1 11h10l1-11" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-semibold tracking-wide uppercase">Shop</span>
            <span className="text-xs text-zinc-700">Coming soon</span>
          </div>

          {/* Missions — 1×2 */}
          <div className="col-span-2 sm:col-span-1 h-[268px] rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-zinc-600">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-none stroke-current stroke-[1.5]" aria-hidden>
              <path d="M9 12l2 2 4-4M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 4h6a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-semibold tracking-wide uppercase">Missions</span>
            <span className="text-xs text-zinc-700">Coming soon</span>
          </div>
        </div>
      </div>
    </>
  )
}
