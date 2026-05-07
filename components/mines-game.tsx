'use client'

import { useMemo, useState } from 'react'
import { BetPanel } from '@/components/bet-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatChips, formatMultiplier } from '@/utils/format'
import { cashOutMines, getMinesPayout, initMines, revealMineTile, startMinesRound } from '@/games/mines/engine'
import type { MinesState } from '@/games/mines/types'

interface MinesResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface MinesGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: MinesResult) => void
}

const DIFFICULTIES: MinesState['difficulty'][] = ['easy', 'medium', 'hard', 'insane']
const DIFFICULTY_LABELS: Record<MinesState['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  insane: 'Insane',
}

export function MinesGame({ mode, bankroll, onResolve }: MinesGameProps) {
  const [difficulty, setDifficulty] = useState<MinesState['difficulty']>('easy')
  const [round, setRound] = useState<MinesState>(initMines())

  const payout = useMemo(() => getMinesPayout(round), [round])
  const safeCount = useMemo(() => round.remainingSafe, [round.remainingSafe])

  function handlePlaceBet(amount: number) {
    setRound(startMinesRound(amount, difficulty))
  }

  function handleTileClick(tileId: number) {
    if (round.stage !== 'inProgress') return

    const next = revealMineTile(round, tileId)
    setRound(next)

    if (next.stage === 'settled' && next.outcome) {
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: getMinesPayout(next),
        multiplier: next.multiplier,
      })
    }
  }

  function handleCashOut() {
    const next = cashOutMines(round)
    setRound(next)
    onResolve({
      outcome: 'win',
      betAmount: next.betAmount,
      payout: getMinesPayout(next),
      multiplier: next.multiplier,
    })
  }

  function handleNewRound() {
    setRound(initMines())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mines</CardTitle>
          <CardDescription>{round.message}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Bankroll</p>
              <p className="font-semibold">{formatChips(bankroll)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Safe tiles left</p>
              <p className="font-semibold">{safeCount}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Multiplier</p>
              <p className="font-semibold">{formatMultiplier(round.multiplier)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase text-muted-foreground">Payout</p>
              <p className="font-semibold">{formatChips(payout)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <p className="font-semibold">Difficulty</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DIFFICULTIES.map((level) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={difficulty === level ? 'default' : 'outline'}
                    onClick={() => setDifficulty(level)}
                  >
                    {DIFFICULTY_LABELS[level]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {round.stage === 'betting' ? (
        <BetPanel mode={mode} freeplayBankroll={bankroll} onBet={handlePlaceBet} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {round.tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleTileClick(tile.id)}
                className={`h-14 rounded-lg border text-sm font-semibold transition-colors ${
                  tile.revealed
                    ? tile.hasMine
                      ? 'border-destructive bg-destructive text-destructive-foreground'
                      : 'border-emerald-500 bg-emerald-200 text-emerald-900'
                    : 'border-border bg-background text-foreground hover:bg-slate-100'
                }`}
              >
                {tile.revealed ? (tile.hasMine ? '💣' : '✓') : ''}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCashOut} disabled={round.stage === 'settled'}>
              Cash Out
            </Button>
            <Button variant="secondary" onClick={handleNewRound}>
              New Round
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
