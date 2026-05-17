'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_CARD_SHELL,
  GAME_BOARD_ARENA,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { getHiloPayout, getHiloPayoutMultiplier, initHilo, resolveHiloRound, startHiloRound } from '@/games/hilo/engine'
import type { HiloState } from '@/games/hilo/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const ROLL_ANIM_MS = 620

interface HiloResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface HiloGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: HiloResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

export function HiloGame({ mode, bankroll, onResolve }: HiloGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [safeZone, setSafeZone] = useState(40)
  const [round, setRound] = useState<HiloState>(initHilo())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)

  // markerAt: position on bar (1–100), null = hidden
  // markerOutcome: null during animation (white marker), set after animation (colored)
  const [markerAt, setMarkerAt] = useState<number | null>(null)
  const [markerOutcome, setMarkerOutcome] = useState<'win' | 'loss' | null>(null)
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const isAnimating  = isInProgress && markerAt !== null

  const displaySafeZone = isBetting ? safeZone : round.safeZone
  const payoutMult = isBetting ? getHiloPayoutMultiplier(safeZone) : round.payoutMultiplier
  const canRoll = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleRoll() {
    if (!canRoll) return

    animTimers.current.forEach(clearTimeout)
    animTimers.current = []

    const bet = currentBet
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)

    // Lock bet + safe zone, move to inProgress
    const started = startHiloRound(bet, safeZone)
    const settled = resolveHiloRound(started)
    const rollPos  = settled.rollResult!
    const outcome  = settled.outcome!

    setRound(started)

    // Marker starts at right edge (danger side), then sweeps to roll position
    setMarkerAt(100)
    setMarkerOutcome(null)

    const t1 = setTimeout(() => setMarkerAt(rollPos), 50)

    const t2 = setTimeout(() => {
      setMarkerOutcome(outcome)
      setRound(settled)

      const po = getHiloPayout(settled)
      onResolve({ outcome, betAmount: bet, payout: po, multiplier: settled.payoutMultiplier })

      const tone: MatchHistoryTone = outcome === 'win' ? 'win' : 'loss'
      const label = outcome === 'win' ? `+${formatChips(po - bet)}` : `−${formatChips(bet)}`
      const entry: MatchHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title: label,
        subtitle: `${formatChips(bet)} bet · Roll ${rollPos} · ${safeZone}% zone · ${formatMultiplier(settled.payoutMultiplier)}`,
        tone,
      }
      setPendingResult({ tone, label, entry })
    }, ROLL_ANIM_MS + 80)

    animTimers.current = [t1, t2]
  }

  const handleNewRound = useCallback(() => {
    animTimers.current.forEach(clearTimeout)
    animTimers.current = []
    setMarkerAt(null)
    setMarkerOutcome(null)
    setRound(initHilo())
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNextRound() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    }
    handleNewRound()
  }

  useEffect(() => () => { animTimers.current.forEach(clearTimeout) }, [])

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Hi-Lo</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-6 md:px-10 py-6 gap-6"
        entries={matchHistory}
        gameLabel="Hi-Lo"
      >

        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}
        {/* Active bet badge */}
        {!isBetting && round.betAmount > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(round.betAmount)}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-8 sm:gap-14">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-teal-600 mb-0.5">Safe</p>
            <p className="text-2xl font-black text-teal-300 tabular-nums">{displaySafeZone}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">Payout</p>
            <p className="text-2xl font-black text-white tabular-nums">{formatMultiplier(payoutMult)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-red-600 mb-0.5">Danger</p>
            <p className="text-2xl font-black text-red-300 tabular-nums">{100 - displaySafeZone}%</p>
          </div>
        </div>

        {/* Risk bar — slider and animation live here */}
        <div className="w-full max-w-md">
          <div className="relative h-14 rounded-full overflow-hidden">
            {/* Danger background */}
            <div className="absolute inset-0 bg-red-900/50" />
            {/* Safe fill */}
            <div
              className="absolute inset-y-0 left-0 bg-teal-700/80 transition-all duration-100"
              style={{ width: `${displaySafeZone}%` }}
            />
            {/* Threshold line */}
            <div
              className="absolute inset-y-0 w-[3px] bg-white/40"
              style={{ left: `calc(${displaySafeZone}% - 1.5px)` }}
            />
            {/* Animated roll marker */}
            {markerAt !== null && (
              <div
                className={`absolute top-[12%] bottom-[12%] w-[5px] rounded-full ${
                  markerOutcome === 'win'
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400/60'
                    : markerOutcome === 'loss'
                      ? 'bg-red-400 shadow-lg shadow-red-400/60'
                      : 'bg-white shadow-lg shadow-white/40'
                }`}
                style={{
                  left: `${markerAt}%`,
                  transform: 'translateX(-50%)',
                  transition:
                    markerAt === 100 || markerOutcome !== null
                      ? 'none'
                      : `left ${ROLL_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                }}
              />
            )}
            {/* Zone labels */}
            <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none select-none">
              <span className="text-teal-100/50 text-sm font-bold">← Safe</span>
              <span className="text-red-200/50 text-sm font-bold">Danger →</span>
            </div>
            {/* Invisible range input — makes the bar draggable */}
            <input
              type="range"
              min={10}
              max={90}
              step={1}
              value={safeZone}
              onChange={(e) => { if (isBetting) setSafeZone(Number(e.currentTarget.value)) }}
              disabled={!isBetting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default appearance-none"
            />
          </div>
          <div className="flex justify-between mt-2 px-1 text-xs text-zinc-600">
            <span>Low risk</span>
            <span>{isBetting ? 'Drag to adjust' : `Rolled ${round.rollResult ?? '—'}`}</span>
            <span>High risk</span>
          </div>
        </div>

        {/* Rules */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-xs text-zinc-600">
          <span>Roll 1–{displaySafeZone} wins</span>
          <span className="text-zinc-800">·</span>
          <span>Roll {displaySafeZone + 1}–100 loses</span>
        </div>

      </GameFieldWithHistory>

      {/* Control zone */}
      <div className={GAME_CONTROL_DOCK_M}>
        {/* Top: variable content */}
        <div className="flex-1 flex flex-col items-center justify-start pt-3 gap-1 min-h-0">
          {isBetting && (
            <div className="w-full max-w-sm flex flex-col gap-1">
              <div className="flex flex-nowrap justify-center gap-2">
                {CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => addChip(chip.value)}
                    disabled={chip.value > bankroll - currentBet}
                    className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    {chip.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addChip(Math.floor(bankroll / 4))}
                  disabled={currentBet >= bankroll || bankroll <= 0}
                  className="h-12 px-3 rounded-full bg-blue-100 hover:bg-blue-50 border-2 border-blue-200 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ¼
                </button>
                <button
                  type="button"
                  onClick={() => addChip(Math.floor(bankroll / 2))}
                  disabled={currentBet >= bankroll || bankroll <= 0}
                  className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ½
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentBet(bankroll)}
                  disabled={currentBet >= bankroll || bankroll <= 0}
                  className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  All In
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-zinc-500 text-base">Bet</span>
                  <span className="font-bold text-xl text-white tabular-nums">
                    {currentBet > 0 ? formatChips(currentBet) : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentBet(0)}
                  className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${currentBet === 0 ? 'invisible' : ''}`}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {isAnimating && (
            <p className="text-sm text-zinc-600 italic">Rolling…</p>
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? 'Safe' : 'Danger'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${
                pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Bottom: action button — anchored */}
        <div className="mx-auto w-full max-w-sm flex flex-col gap-1 pb-2">
          {isBetting && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleRoll}
                disabled={!canRoll}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Roll →
              </button>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleNextRound}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Next →
              </button>
            </div>
          )}
          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
