'use client'

import Link from 'next/link'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { Badge } from '@/components/ui/badge'

export function Navbar() {
  const { bankroll, sparks, streak, jackpotMeter, currentFloor, runActive } =
    useSurvivalStore()

  return (
    <nav className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold tracking-tight">
        FLOORED
      </Link>

      {runActive ? (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Floor</span>
          <Badge variant="outline">{currentFloor}</Badge>

          <span className="text-muted-foreground">Bankroll</span>
          <span className="font-mono font-semibold text-emerald-400">
            {formatChips(bankroll)}
          </span>

          <span className="text-muted-foreground">Sparks</span>
          <span className="font-mono text-yellow-400">{sparks}</span>

          <span className="text-muted-foreground">Streak</span>
          <span className="font-mono text-orange-400">{streak}</span>

          <span className="text-muted-foreground">Jackpot</span>
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${jackpotMeter}%` }}
            />
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">No active run</span>
      )}
    </nav>
  )
}
