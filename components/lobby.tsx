'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { GameName } from '@/store/types'

interface GameEntry {
  name: GameName
  label: string
  available: boolean
}

const GAMES: GameEntry[] = [
  { name: 'blackjack',    label: 'Blackjack',    available: false },
  { name: 'crash',        label: 'Crash',        available: false },
  { name: 'plinko',       label: 'Plinko',       available: false },
  { name: 'hilo',         label: 'Hi-Lo',        available: false },
  { name: 'dice',         label: 'Dice',         available: false },
  { name: 'run-dice',     label: 'Run Dice',     available: false },
  { name: 'mines',        label: 'Mines',        available: false },
  { name: 'chicken-road', label: 'Chicken Road', available: false },
  { name: 'slots',        label: 'Slots',        available: false },
]

interface Props {
  mode: 'survival' | 'freeplay'
}

export function Lobby({ mode }: Props) {
  const router = useRouter()

  function handlePick(game: GameName) {
    router.push(`/${mode}/${game}`)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {GAMES.map((g) => (
        <Card
          key={g.name}
          className={`transition-colors ${
            g.available
              ? 'cursor-pointer hover:border-primary'
              : 'opacity-40 cursor-not-allowed'
          }`}
          onClick={() => g.available && handlePick(g.name)}
        >
          <CardHeader className="py-4">
            <CardTitle className="text-base">{g.label}</CardTitle>
            {!g.available && (
              <p className="text-xs text-muted-foreground">Coming soon</p>
            )}
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
