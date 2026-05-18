'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { cashOutMines, getMinesPayout, initMines, revealMineTile, startMinesRound } from '@/games/mines/engine'
import type { MinesState } from '@/games/mines/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const DIFFICULTIES: MinesState['difficulty'][] = ['easy', 'medium', 'hard', 'insane']

const DIFFICULTY_LABELS: Record<MinesState['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  insane: 'Insane',
}

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

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

export function MinesGame({ mode, bankroll, onResolve }: MinesGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [difficulty, setDifficulty] = useState<MinesState['difficulty']>('easy')
  const [round, setRound] = useState<MinesState>(initMines())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)

  const payout = useMemo(
    () => round.stage === 'inProgress' ? Math.round(round.betAmount * round.multiplier) : getMinesPayout(round),
    [round]
  )

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const canStart     = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
    setLastBet(currentBet)
    setPendingResult(null)
    setRound(startMinesRound(currentBet, difficulty))
    setCurrentBet(0)
  }

  function handleTileClick(tileId: number) {
    if (round.stage !== 'inProgress') return
    const next = revealMineTile(round, tileId)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      const payoutAmount = getMinesPayout(next)
      onResolve({ outcome: next.outcome, betAmount: next.betAmount, payout: payoutAmount, multiplier: next.multiplier })
      const tone: MatchHistoryTone = next.outcome === 'win' ? 'win' : 'loss'
      const historyLabel = next.outcome === 'win' ? `+${formatChips(payoutAmount - next.betAmount)}` : `−${formatChips(next.betAmount)}`
      const displayLabel = next.outcome === 'win' ? formatChips(payoutAmount) : historyLabel
      setPendingResult({
        tone, label: displayLabel,
        entry: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: historyLabel,
          subtitle: next.outcome === 'win'
            ? `${formatChips(next.betAmount)} bet · Cash out · ${formatMultiplier(next.multiplier)}`
            : `${formatChips(next.betAmount)} bet · Mine hit`,
          tone,
        },
      })
    }
  }

  function handleCashOut() {
    const next = cashOutMines(round)
    setRound(next)
    const payoutAmount = getMinesPayout(next)
    onResolve({ outcome: 'win', betAmount: next.betAmount, payout: payoutAmount, multiplier: next.multiplier })
    const historyLabel = `+${formatChips(payoutAmount - next.betAmount)}`
    setPendingResult({
      tone: 'win', label: formatChips(payoutAmount),
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title: historyLabel,
        subtitle: `${formatChips(next.betAmount)} bet · Cash out · ${formatMultiplier(next.multiplier)}`,
        tone: 'win',
      },
    })
  }

  const handleNewRound = useCallback(() => {
    setRound(initMines())
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    handleNewRound()
  }

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Mines</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 flex flex-col items-center justify-center px-4 py-6 md:px-6 gap-4"
        entries={matchHistory}
        gameLabel="Mines"
      >
        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}
        {!isBetting && round.betAmount > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(round.betAmount)}</p>
          </div>
        )}

        {/* Stats — always rendered to hold space; invisible during betting */}
        <div className={`flex flex-wrap gap-3 ${isBetting ? 'invisible pointer-events-none' : ''}`}>
          <div className="rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/40">Safe left </span>
            <span className="font-semibold text-white">{round.remainingSafe}</span>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/40">Multiplier </span>
            <span className="font-semibold text-white">{formatMultiplier(round.multiplier)}</span>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/40">Potential </span>
            <span className="font-semibold text-emerald-400">{formatChips(payout)}</span>
          </div>
        </div>

        {/* Mine grid */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full max-w-sm">
          {round.tiles.length > 0 ? (
            round.tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleTileClick(tile.id)}
                disabled={!isInProgress || tile.revealed}
                className={`h-12 rounded-lg text-lg font-bold transition-all active:scale-95 sm:h-14 ${
                  tile.revealed
                    ? tile.hasMine
                      ? 'border border-red-400 bg-red-600 text-white shadow-lg shadow-red-900/50'
                      : 'border border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                    : isInProgress
                      ? 'cursor-pointer border border-white/20 bg-white/10 text-white/0 hover:border-white/40 hover:bg-white/20'
                      : 'cursor-default border border-white/10 bg-white/5 text-white/0'
                }`}
              >
                {tile.revealed ? (tile.hasMine ? '💣' : '✓') : ''}
              </button>
            ))
          ) : (
            Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg border border-white/10 bg-white/5 sm:h-14" />
            ))
          )}
        </div>
      </GameFieldWithHistory>

      {/* Fixed-height dock — 4 evenly distributed slots, never shifts between states */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 rounded-b-2xl h-[284px] flex flex-col justify-between py-4">

        {/* Slot 1: difficulty selector (betting) — invisible placeholder during game */}
        <div className={`flex justify-center gap-2 ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
          {DIFFICULTIES.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficulty(level)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                difficulty === level ? 'bg-white text-gray-900' : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              {DIFFICULTY_LABELS[level]}
            </button>
          ))}
        </div>

        {/* Slot 2: chip row (betting) — invisible placeholder during game */}
        <div className={`flex flex-nowrap justify-center gap-2 ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
          {CHIPS.map((chip) => (
            <button key={chip.value} type="button" onClick={() => addChip(chip.value)} disabled={chip.value > bankroll - currentBet}
              className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}>
              {chip.label}
            </button>
          ))}
          <button type="button" onClick={() => addChip(Math.floor(bankroll / 4))} disabled={currentBet >= bankroll || bankroll <= 0}
            className="h-12 px-3 rounded-full bg-blue-100 hover:bg-blue-50 border-2 border-blue-200 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
            ¼
          </button>
          <button type="button" onClick={() => addChip(Math.floor(bankroll / 2))} disabled={currentBet >= bankroll || bankroll <= 0}
            className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
            ½
          </button>
          <button type="button" onClick={() => setCurrentBet(bankroll)} disabled={currentBet >= bankroll || bankroll <= 0}
            className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
            All In
          </button>
        </div>

        {/* Slot 3: info display — bet amount, payout info, or outcome */}
        <div className="flex flex-col items-center justify-center gap-1 min-h-[56px]">
          {isBetting && (
            <>
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Bet</span>
                <span className="font-bold text-xl text-white tabular-nums">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
              </div>
              <button type="button" onClick={() => setCurrentBet(0)}
                className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${currentBet === 0 ? 'invisible' : ''}`}>
                Clear
              </button>
            </>
          )}
          {isInProgress && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Bet</span>
              <span className="font-semibold text-white">{formatChips(round.betAmount)}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">Potential</span>
              <span className="font-semibold text-emerald-400">{formatChips(payout)}</span>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? 'Cashed out' : 'Mine hit'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Slot 4: action button */}
        <div className="flex flex-col items-center gap-1">
          {isBetting && (
            <button type="button" onClick={handleStart} disabled={!canStart}
              className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
              Start →
            </button>
          )}
          {isInProgress && (
            <button type="button" onClick={handleCashOut}
              className="min-w-[10.5rem] px-7 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-base shadow-lg">
              Cash Out
            </button>
          )}
          {isSettled && pendingResult && (
            <button type="button" onClick={handleNext}
              className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
              Next →
            </button>
          )}
          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
