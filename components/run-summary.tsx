'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatChips } from '@/utils/format'
import type { RunSummary } from '@/store/types'

interface RunSummaryProps {
  lastRun: RunSummary
}

export function RunSummary({ lastRun }: RunSummaryProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run Complete</CardTitle>
          <CardDescription>Review your final survival run results before starting again.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Difficulty</p>
            <p className="font-semibold capitalize">{lastRun.difficulty}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Floor reached</p>
            <p className="font-semibold">{lastRun.floorsReached}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">End bankroll</p>
            <p className="font-semibold">{formatChips(lastRun.endBankroll)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Peak bankroll</p>
            <p className="font-semibold">{formatChips(lastRun.peakBankroll)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Games played</p>
            <p className="font-semibold">{lastRun.gamesPlayed}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sparks earned</p>
            <p className="font-semibold">{lastRun.sparksEarned}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm text-muted-foreground">Ended at</p>
            <p className="font-semibold">{new Date(lastRun.endedAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted">
          Back to Home
        </Link>
        <Button asChild>
          <Link href="/">Start New Run</Link>
        </Button>
      </div>
    </div>
  )
}
