'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSurvivalStore } from '@/store/survival-store'
import type { RunSummary as RunSummaryType } from '@/store/types'

interface RunSummaryProps {
  lastRun: RunSummaryType
}

function headline(lastRun: RunSummaryType): { title: string; description: string; accent: string } {
  if (lastRun.victory) {
    return {
      title: '🏆 Victory!',
      description: 'You cleared all 10 floors.',
      accent: 'text-amber-400',
    }
  }
  if (lastRun.endBankroll <= 0) {
    return {
      title: 'Defeated',
      description: 'Your bankroll hit zero.',
      accent: 'text-red-400',
    }
  }
  return {
    title: 'Run Over',
    description: lastRun.endlessMode
      ? `Endless run ended on floor ${lastRun.floorsReached}.`
      : 'Your survival run has ended.',
    accent: 'text-zinc-300',
  }
}

export function RunSummary({ lastRun }: RunSummaryProps) {
  const router = useRouter()
  const clearLastRun = useSurvivalStore((s) => s.clearLastRun)
  const { title, description, accent } = headline(lastRun)

  function handleContinue() {
    clearLastRun()
    router.push('/')
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className={accent}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>

      <Button onClick={handleContinue} className="w-full max-w-xs" size="lg">
        Continue
      </Button>
    </div>
  )
}
