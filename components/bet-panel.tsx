'use client'

import { useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatChips } from '@/utils/format'

interface Props {
  onBet: (amount: number) => void
  mode?: 'survival' | 'freeplay'
  freeplayBankroll?: number
}

export function BetPanel({ onBet, mode = 'survival', freeplayBankroll }: Props) {
  const { bankroll, floorMinBet } = useSurvivalStore()

  const effectiveBankroll = mode === 'freeplay' ? (freeplayBankroll ?? 10_000) : bankroll
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [raw, setRaw] = useState<string>(String(minBet))
  const parsed = parseInt(raw, 10)
  const valid = !isNaN(parsed) && parsed >= minBet && parsed <= effectiveBankroll

  const quickBets = [minBet, minBet * 2, minBet * 5].filter((b) => b <= effectiveBankroll)

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <div className="flex items-center justify-between">
        <Label htmlFor="bet-input">Bet Amount</Label>
        {mode === 'survival' && (
          <span className="text-xs text-muted-foreground">Min: {formatChips(minBet)}</span>
        )}
      </div>

      <Input
        id="bet-input"
        type="number"
        min={minBet}
        max={effectiveBankroll}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className={!valid && raw !== '' ? 'border-destructive' : ''}
      />

      <div className="flex gap-2">
        {quickBets.map((b) => (
          <Button
            key={b}
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setRaw(String(b))}
          >
            {formatChips(b)}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRaw(String(effectiveBankroll))}
        >
          All In
        </Button>
      </div>

      <Button onClick={() => valid && onBet(parsed)} disabled={!valid} className="w-full">
        Place Bet
      </Button>
    </div>
  )
}
