'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { DifficultyDialog } from '@/components/difficulty-dialog'

export function ModeSelect() {
  const router = useRouter()
  const [difficultyOpen, setDifficultyOpen] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setDifficultyOpen(true)}
        >
          <CardHeader>
            <CardTitle>Survival</CardTitle>
            <CardDescription>
              Endless floors. Rising minimum bets. Run ends when you go broke.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Starts at 1,000 chips</li>
              <li>Floor minimum bet rises each level</li>
              <li>Earn Sparks for upgrades</li>
              <li>Leaderboard ranking</li>
            </ul>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => router.push('/freeplay')}
        >
          <CardHeader>
            <CardTitle>Freeplay</CardTitle>
            <CardDescription>
              All games, no floors, no pressure. 10,000 chips to start.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>No economy, no stakes</li>
              <li>Practice any game</li>
              <li>Infinite reset</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <DifficultyDialog
        open={difficultyOpen}
        onClose={() => setDifficultyOpen(false)}
      />
    </>
  )
}
