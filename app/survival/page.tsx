'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'

export default function SurvivalPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)

  useEffect(() => {
    if (!runActive) router.replace('/')
  }, [runActive, router])

  if (!runActive) return null

  return (
    <div className="flex flex-col gap-6">
      <FloorPanel />
      <Lobby mode="survival" />
    </div>
  )
}
