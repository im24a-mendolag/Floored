'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_FRAME,
  GAME_CONTROL_DOCK_S,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { appendPlay } from '@/components/game-history-utils'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { GameOutcomeToast, type GameOutcomeToastSnap } from '@/components/game-outcome-toast'
import { formatChips, formatMultiplier } from '@/utils/format'
import { cashOutMines, getMinesPayout, initMines, revealMineTile, startMinesRound } from '@/games/mines/engine'
import type { MinesState } from '@/games/mines/types'

const CHIPS = [
  { value: 10, label: '$10', bg: 'bg-red-600 hover:bg-red-500', border: 'border-red-300' },
  { value: 25, label: '$25', bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500', border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600', border: 'border-zinc-400' },
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

export function MinesGame({ mode, bankroll, onResolve }: MinesGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()

  const minBet = mode === 'survival' ? floorMinBet : 1

  const [difficulty, setDifficulty] = useState<MinesState['difficulty']>('easy')
  const [round, setRound] = useState<MinesState>(initMines())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [minesToastOpen, setMinesToastOpen] = useState(false)
  const [minesToastSnap, setMinesToastSnap] = useState<GameOutcomeToastSnap | null>(null)

  const lastMinesToastKey = useRef('')

  const payout = useMemo(() => getMinesPayout(round), [round])
  const safeCount = useMemo(() => round.remainingSafe, [round.remainingSafe])

  const isBetting = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled = round.stage === 'settled'

  const canStart = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return

    setLastBet(currentBet)
    setRound(startMinesRound(currentBet, difficulty))
    setCurrentBet(0)
  }

  function handleTileClick(tileId: number) {
    if (round.stage !== 'inProgress') return

    const next = revealMineTile(round, tileId)

    setRound(next)

    if (next.stage === 'settled' && next.outcome) {
      const payoutAmount = getMinesPayout(next)

      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: payoutAmount,
        multiplier: next.multiplier,
      })

      appendPlay(setMatchHistory, {
        bet: next.betAmount,
        payout: payoutAmount,
        mult: next.multiplier,
        outcome: next.outcome,
        titlePrefix: next.outcome === 'loss' ? 'Mine hit' : 'Cash out',
      })
    }
  }

  function handleCashOut() {
    const next = cashOutMines(round)

    setRound(next)

    const payoutAmount = getMinesPayout(next)

    onResolve({
      outcome: 'win',
      betAmount: next.betAmount,
      payout: payoutAmount,
      multiplier: next.multiplier,
    })

    appendPlay(setMatchHistory, {
      bet: next.betAmount,
      payout: payoutAmount,
      mult: next.multiplier,
      outcome: 'win',
      titlePrefix: 'Cash out',
    })
  }

  const dismissMinesToast = useCallback(() => {
    setMinesToastOpen(false)
    setMinesToastSnap(null)
  }, [])

  const handleNewRound = useCallback(() => {
    setRound(initMines())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  useEffect(() => {
    if (isBetting) {
      lastMinesToastKey.current = ''
    }
  }, [isBetting])

  useEffect(() => {
    if (!isSettled || !round.outcome) return

    const key = `${round.outcome}-${round.betAmount}-${round.multiplier}`

    if (lastMinesToastKey.current === key) return

    lastMinesToastKey.current = key

    const payoutAmount = getMinesPayout(round)

    const title = round.outcome === 'win' ? 'Cashed out' : 'Mine hit'

    const subtitle =
      round.outcome === 'win'
        ? `+${formatChips(payoutAmount)}`
        : `−${formatChips(round.betAmount)}`

    const tone = round.outcome === 'win' ? 'win' : 'loss'

    setMinesToastSnap({ title, subtitle, tone })
    setMinesToastOpen(true)

    queueMicrotask(() => handleNewRound())
  }, [
    isSettled,
    round.outcome,
    round.betAmount,
    round.multiplier,
    handleNewRound,
    round,
  ])

  return (
    <div
      className={GAME_CARD_FRAME}
      style={{
        background: 'linear-gradient(160deg, #0f4c2a 0%, #0a3d22 100%)',
      }}
    >
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">
          Mines
        </span>

        <span className="text-sm text-zinc-600">
          {round.message}
        </span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 p-4 md:p-5"
        entries={matchHistory}
        gameLabel="Mines"
      >
        {/* Stats row */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-lg bg-black/20 px-3 py-2 text-sm">
            <span className="text-white/40">Safe left </span>
            <span className="font-semibold text-white">{safeCount}</span>
          </div>

          <div className="rounded-lg bg-black/20 px-3 py-2 text-sm">
            <span className="text-white/40">Multiplier </span>
            <span className="font-semibold text-white">
              {formatMultiplier(round.multiplier)}
            </span>
          </div>

          <div className="rounded-lg bg-black/20 px-3 py-2 text-sm">
            <span className="text-white/40">Payout </span>
            <span className="font-semibold text-emerald-400">
              {formatChips(payout)}
            </span>
          </div>
        </div>

        {/* Difficulty selector */}
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-white/30">
            Difficulty
          </p>

          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  if (isBetting) setDifficulty(level)
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  difficulty === level
                    ? 'bg-white text-gray-900'
                    : 'bg-white/10 text-white/50 hover:bg-white/15'
                } ${!isBetting ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Mine grid */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
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
              <div
                key={i}
                className="h-12 rounded-lg border border-white/10 bg-white/5 sm:h-14"
              />
            ))
          )}
        </div>
      </GameFieldWithHistory>

      <GameOutcomeToast
        open={minesToastOpen && !!minesToastSnap}
        title={minesToastSnap?.title ?? ''}
        subtitle={minesToastSnap?.subtitle}
        tone={minesToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissMinesToast}
      />

      <div className={GAME_CONTROL_DOCK_S}>
        {isBetting && (
          <div className="relative z-10">
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => addChip(chip.value)}
                  disabled={chip.value > bankroll - currentBet}
                  className={`h-14 w-14 rounded-full border-2 text-xs font-bold text-white shadow-lg transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-25 ${chip.bg} ${chip.border}`}
                >
                  {chip.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentBet(bankroll)}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className="h-14 rounded-full border-2 border-amber-300 bg-amber-500 px-3 text-xs font-bold text-black shadow-lg transition-transform hover:bg-amber-400 active:scale-90 active:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-25"
              >
                All In
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <span className="text-sm text-white/50">Bet</span>

                <span className="text-lg font-bold">
                  {currentBet > 0 ? formatChips(currentBet) : '—'}
                </span>

                {currentBet > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentBet(0)}
                    className="ml-1 text-xs text-white/35 transition-colors hover:text-white/70"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                className="rounded-lg bg-yellow-500 px-5 py-2 text-sm font-bold text-black shadow-lg transition-all hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/25"
              >
                Start →
              </button>
            </div>

            {minBet > 1 && (
              <p className="mt-1 text-xs text-white/25">
                Min bet: {formatChips(minBet)}
              </p>
            )}
          </div>
        )}

        {isInProgress && (
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-white/50">
                Bet{' '}
                <span className="font-semibold text-white">
                  {formatChips(round.betAmount)}
                </span>

                <span className="mx-2 text-white/30">·</span>

                <span className="font-semibold text-emerald-400">
                  {formatChips(payout)} if cashed
                </span>
              </span>

              <button
                type="button"
                onClick={handleCashOut}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-500"
              >
                Cash Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}