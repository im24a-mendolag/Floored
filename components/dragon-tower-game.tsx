'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import {
  FLOOR_MULTIPLIERS,
  NUM_ROWS,
  TILES_PER_ROW,
  cashOut,
  initDragonTower,
  pickTile,
  startDragonTower,
} from '@/games/dragon-tower/engine'
import type { DragonTowerState, TileRow } from '@/games/dragon-tower/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

interface DragonTowerResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface DragonTowerGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: DragonTowerResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

function tileStyle(row: TileRow, tileIdx: number, isActive: boolean): string {
  const base = 'w-14 h-11 sm:w-16 sm:h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all duration-150 select-none'
  if (row.picked === tileIdx) {
    return tileIdx === row.dragonAt
      ? `${base} bg-red-800 border-red-500 text-white`
      : `${base} bg-emerald-700 border-emerald-400 text-white`
  }
  if (row.revealed && tileIdx === row.dragonAt) {
    return `${base} bg-red-950/50 border-red-800/50 text-red-700/70`
  }
  if (row.picked !== null) {
    return `${base} bg-zinc-800/30 border-zinc-800/30 text-transparent`
  }
  if (isActive) {
    return `${base} bg-zinc-700 border-zinc-500 text-zinc-400 hover:bg-fuchsia-900/60 hover:border-fuchsia-600 cursor-pointer active:scale-95`
  }
  return `${base} bg-zinc-800/50 border-zinc-700/40 text-transparent cursor-default`
}

function tileContent(row: TileRow, tileIdx: number): string {
  if (row.picked === tileIdx) {
    return tileIdx === row.dragonAt ? '🐉' : '✓'
  }
  if (row.revealed && tileIdx === row.dragonAt) return '🐉'
  return ''
}

export function DragonTowerGame({ mode, bankroll, onResolve }: DragonTowerGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [state, setState] = useState<DragonTowerState>(initDragonTower)
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])

  const isBetting  = state.stage === 'betting'
  const isClimbing = state.stage === 'climbing'
  const isSettled  = state.stage === 'cashed-out' || state.stage === 'busted'
  const canStart   = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart) return
    setLastBet(currentBet)
    setState(startDragonTower(currentBet))
    setCurrentBet(0)
    setPendingResult(null)
  }

  function handlePickTile(tileIdx: number) {
    const next = pickTile(state, tileIdx)
    setState(next)
    if (next.stage === 'busted' || next.stage === 'cashed-out') resolveGame(next)
  }

  function handleCashOut() {
    const next = cashOut(state)
    setState(next)
    resolveGame(next)
  }

  function resolveGame(next: DragonTowerState) {
    const payout = next.outcome === 'win'
      ? Math.round(next.betAmount * next.cashoutMultiplier)
      : 0
    onResolve({
      outcome: next.outcome!,
      betAmount: next.betAmount,
      payout,
      multiplier: next.outcome === 'win' ? next.cashoutMultiplier : 0,
    })
    const net = payout - next.betAmount
    const tone: MatchHistoryTone = next.outcome === 'win' ? 'win' : 'loss'
    const title = next.outcome === 'win' ? `+${formatChips(net)}` : `−${formatChips(next.betAmount)}`
    const label = next.outcome === 'win' ? formatChips(payout) : title
    const floorReached = next.activeRow
    setPendingResult({
      tone, label,
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title,
        subtitle: `${formatChips(next.betAmount)} · Floor ${floorReached} · ${next.outcome === 'win' ? formatMultiplier(next.cashoutMultiplier) : 'Burned'}`,
        tone,
      },
    })
  }

  const handleNext = useCallback(() => {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    setState(initDragonTower())
    setCurrentBet(autoReBet && lastBet <= bankroll ? lastBet : 0)
  }, [pendingResult, autoReBet, lastBet, bankroll])

  const cashoutPayout = isClimbing && state.cashoutMultiplier > 0
    ? Math.round(state.betAmount * state.cashoutMultiplier)
    : 0

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Dragon Tower</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-3 gap-0"
        entries={matchHistory}
        gameLabel="Dragon Tower"
      >
        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}
        {isClimbing && state.betAmount > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(state.betAmount)}</p>
          </div>
        )}

        {/* Tower rows — displayed top (hardest) to bottom (easiest/active first) */}
        <div className="flex flex-col gap-1.5 w-full max-w-xs">
          {Array.from({ length: NUM_ROWS }, (_, i) => NUM_ROWS - 1 - i).map(rowIdx => {
            const row = state.rows[rowIdx]!
            const floorNum = rowIdx + 1
            const mult = FLOOR_MULTIPLIERS[rowIdx]!
            const isActive = isClimbing && rowIdx === state.activeRow
            const isCleared = rowIdx < state.activeRow
            const isFuture = !isActive && !isCleared && !(isSettled && row.picked !== null)

            return (
              <div
                key={rowIdx}
                className={[
                  'flex items-center gap-2 rounded-xl px-2 py-1 transition-colors',
                  isActive ? 'bg-fuchsia-950/30 ring-1 ring-fuchsia-800/50' : '',
                  isCleared ? 'bg-zinc-900/40' : '',
                ].join(' ')}
              >
                {/* Floor label + multiplier */}
                <div className="w-14 shrink-0 text-right">
                  <p className={`text-[10px] font-medium leading-none mb-0.5 ${isActive ? 'text-fuchsia-400' : isCleared ? 'text-zinc-500' : 'text-zinc-700'}`}>
                    F{floorNum}
                  </p>
                  <p className={`text-xs font-bold tabular-nums leading-none ${isActive ? 'text-white' : isCleared ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {mult.toFixed(2)}×
                  </p>
                </div>

                {/* Tiles */}
                <div className="flex gap-1.5 flex-1 justify-center">
                  {Array.from({ length: TILES_PER_ROW }, (_, ti) => (
                    <button
                      key={ti}
                      type="button"
                      disabled={!isActive}
                      onClick={() => isActive && handlePickTile(ti)}
                      className={tileStyle(row, ti, isActive)}
                    >
                      {tileContent(row, ti)}
                    </button>
                  ))}
                </div>

                {/* Status icon */}
                <div className="w-6 shrink-0 text-center text-base">
                  {isCleared && <span className="text-emerald-500">✓</span>}
                  {isSettled && row.picked !== null && !isCleared && (
                    row.dragonAt === row.picked
                      ? <span className="text-red-500">✗</span>
                      : <span className="text-emerald-500">✓</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </GameFieldWithHistory>

      {/* Control zone — fully stable layout across all phases */}
      <div className={GAME_CONTROL_DOCK_M}>
        <div className="flex flex-col gap-3 py-3">

          {/* Chips row — invisible (not removed) when not betting so height is preserved */}
          <div className={`flex flex-nowrap justify-center gap-2 ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
            {CHIPS.map(chip => (
              <button key={chip.value} type="button" onClick={() => addChip(chip.value)}
                disabled={chip.value > bankroll - currentBet}
                className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}>
                {chip.label}
              </button>
            ))}
            <button type="button" onClick={() => addChip(Math.floor(bankroll / 2))}
              disabled={currentBet >= bankroll || bankroll <= 0}
              className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
              ½
            </button>
            <button type="button" onClick={() => setCurrentBet(bankroll)}
              disabled={currentBet >= bankroll || bankroll <= 0}
              className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
              All In
            </button>
          </div>

          {/* Info row — fixed height, swaps content per phase */}
          <div className="h-10 flex items-center justify-center">
            {isBetting && (
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Bet</span>
                <span className="font-bold text-xl text-white tabular-nums">
                  {currentBet > 0 ? formatChips(currentBet) : '—'}
                </span>
                {currentBet > 0 && (
                  <button type="button" onClick={() => setCurrentBet(0)}
                    className="px-2 py-0.5 text-xs font-medium rounded border border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-white transition-colors">
                    Clear
                  </button>
                )}
              </div>
            )}
            {isClimbing && cashoutPayout === 0 && (
              <p className="text-sm text-zinc-600">Clear a floor to unlock cash out.</p>
            )}
            {isClimbing && cashoutPayout > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Value</span>
                <span className="font-bold text-xl text-emerald-400 tabular-nums">{formatChips(cashoutPayout)}</span>
                <span className="text-xs text-zinc-500">{formatMultiplier(state.cashoutMultiplier)}</span>
              </div>
            )}
            {isSettled && pendingResult && (
              <div className="flex items-center gap-3">
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {pendingResult.tone === 'win' ? 'Win' : 'Burned'}
                </p>
                <p className={`text-2xl font-black tabular-nums ${pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pendingResult.label}
                </p>
              </div>
            )}
          </div>

          {/* Single action button — always in same position, label/style changes per phase */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={isSettled ? handleNext : isClimbing ? handleCashOut : handleStart}
              disabled={(isBetting && !canStart) || (isClimbing && cashoutPayout === 0)}
              className={[
                'min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg',
                isClimbing && cashoutPayout > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white'
                  : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900',
              ].join(' ')}
            >
              {isSettled
                ? 'Next →'
                : isClimbing
                  ? (cashoutPayout > 0 ? `Cash Out — ${formatChips(cashoutPayout)}` : 'Cash Out')
                  : 'Climb →'}
            </button>
          </div>

          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
