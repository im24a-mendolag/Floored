'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import { pickQuote } from '@/lib/gambling-quotes'
import {
  BET_LABELS,
  EUROPEAN_WHEEL_ORDER,
  getLabelForTarget,
  getNumberColor,
  getPayoutForTarget,
  initRoulette,
  spinRoulette,
} from '@/games/roulette/engine'
import type { RouletteBetType, RouletteState } from '@/games/roulette/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

// Standard European roulette board layout: 3 rows top-to-bottom, 12 columns left-to-right
const BOARD_ROWS = [
  [3,  6,  9,  12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2,  5,  8,  11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1,  4,  7,  10, 13, 16, 19, 22, 25, 28, 31, 34],
]

const SPIN_MS = 4600
const SPIN_ANIMATION_MS = 4000 // Wheel tick sequence — long tail, mostly time in the last ticks

/** Per-tick delays: very fast early ticks, very long pauses at the end (normalized to `totalMs`). */
function buildSlowdownDelays(stepCount: number, totalMs: number): number[] {
  if (stepCount <= 0) return []
  const weights: number[] = []
  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 1 : i / (stepCount - 1)
    // Strong exp curve: almost all wall-clock time sits in the final ticks
    weights.push(Math.exp(14.5 * t))
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (w / sum) * totalMs)
}

// Pocket order follows the real European wheel (each tick shows correct red / black / green)
const WHEEL_POSITIONS: string[] = EUROPEAN_WHEEL_ORDER.map(String)

interface RouletteResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface RouletteGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: RouletteResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

function betBtnStyle(type: RouletteBetType, isActive: boolean, hasBet: boolean): string {
  const base = 'rounded-lg transition-all duration-150 flex flex-col items-center'

  if (type === 'red') return `${base} border-2 ${
    isActive ? 'bg-red-600 border-red-400 text-white' :
    hasBet   ? 'bg-red-900/50 border-red-700/60 text-red-200 hover:border-red-600/70' :
               'border-red-900/30 text-red-800/50 hover:border-red-800/50 hover:text-red-600/70'
  }`

  if (type === 'black') return `${base} border-2 ${
    isActive ? 'bg-zinc-500 border-zinc-300 text-white' :
    hasBet   ? 'bg-zinc-700/60 border-zinc-500/60 text-zinc-200 hover:border-zinc-400/70' :
               'border-zinc-700/30 text-zinc-600/50 hover:border-zinc-600/50 hover:text-zinc-500/70'
  }`

  if (type === 'green') return `${base} border-2 ${
    isActive ? 'bg-emerald-600 border-emerald-400 text-white' :
    hasBet   ? 'bg-emerald-900/50 border-emerald-700/60 text-emerald-200 hover:border-emerald-600/70' :
               'border-emerald-900/30 text-emerald-800/50 hover:border-emerald-800/50 hover:text-emerald-600/70'
  }`

  return `${base} border ${
    isActive ? 'bg-white/15 border-white/40 text-white' :
    hasBet   ? 'bg-white/10 border-white/25 text-white/80 hover:border-white/35' :
               'border-white/15 text-white/30 hover:border-white/30 hover:text-white/60'
  }`
}

export function RouletteGame({ mode, bankroll, onResolve }: RouletteGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<RouletteState>(initRoulette())
  const [currentBet, setCurrentBet] = useState(0)
  const [currentTarget, setCurrentTarget] = useState<string | null>(null)
  const [lastBet, setLastBet] = useState(0)
  const [lastTarget, setLastTarget] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [spinningPosition, setSpinningPosition] = useState<string | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const spinTickRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const budget = bankroll - currentBet
  const isBetting = round.stage === 'betting' && !spinning
  const isSettled = round.stage === 'settled' && !spinning
  const canSpin =
    currentTarget !== null && currentBet >= minBet && currentBet <= bankroll

  function selectTarget(target: string) {
    if (currentTarget === target && currentBet === 0) {
      setCurrentTarget(null)
    } else if (currentBet === 0) {
      setCurrentTarget(target)
    }
  }

  function addChip(value: number) {
    if (!currentTarget) return
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function clearBet() {
    setCurrentBet(0)
    setCurrentTarget(null)
  }

  function handleSpin() {
    if (!canSpin || spinning || !currentTarget) return

    const total = currentBet
    const spunTarget = currentTarget

    setLastBet(currentBet)
    setLastTarget(currentTarget)
    setCurrentBet(0)
    setCurrentTarget(null)
    setPendingResult(null)

    const result = spinRoulette(spunTarget, total)
    setQuoteIdx((prev) => pickQuote(prev))
    setSpinning(true)
    setSpinningPosition(WHEEL_POSITIONS[0] ?? '0')

    const totalSpins = Math.floor(WHEEL_POSITIONS.length * 2.5)
    const tickCount = Math.max(1, totalSpins - 1)
    const tickDelays = buildSlowdownDelays(tickCount, SPIN_ANIMATION_MS)

    const scheduleSpinTick = (tick: number) => {
      if (tick >= tickCount) {
        spinTickRef.current = null
        setSpinningPosition(null)
        return
      }
      spinTickRef.current = setTimeout(() => {
        const positionIndex = tick + 1
        const idx = positionIndex % WHEEL_POSITIONS.length
        const position = WHEEL_POSITIONS[idx]
        if (position) setSpinningPosition(position)
        scheduleSpinTick(tick + 1)
      }, tickDelays[tick] ?? 0)
    }
    scheduleSpinTick(0)

    settleRef.current = setTimeout(() => {
      if (spinTickRef.current) { clearTimeout(spinTickRef.current); spinTickRef.current = null }
      setSpinningPosition(null)
      setSpinning(false)
      setRound(result)

      const net = result.totalPayout - result.totalBetAmount
      const tone: MatchHistoryTone = net > 0 ? 'win' : 'loss'
      const historyLabel = net >= 0
        ? `+${formatChips(net)}`
        : `−${formatChips(-net)}`
      const displayLabel = net > 0 ? formatChips(result.totalPayout) : historyLabel

      onResolve({
        outcome: result.outcome!,
        betAmount: result.totalBetAmount,
        payout: result.totalPayout,
        multiplier: total > 0 ? result.totalPayout / total : 0,
      })

      const resultLabel = result.result === 0
        ? 'Zero'
        : `${result.result} ${result.resultColor}`
      const betSummary =
        total > 0 ? `${getLabelForTarget(spunTarget)} ${formatChips(total)}` : ''

      setPendingResult({
        tone, label: displayLabel,
        entry: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: historyLabel,
          subtitle: `${betSummary} · ${resultLabel}`,
          tone,
        },
      })
    }, SPIN_MS)
  }

  const handleNewRound = useCallback(() => {
    setRound(initRoulette())
    setPendingResult(null)
    if (autoReBet && lastBet > 0 && lastTarget && lastBet <= bankroll) {
      setCurrentBet(lastBet)
      setCurrentTarget(lastTarget)
    }
  }, [autoReBet, lastBet, lastTarget, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    handleNewRound()
  }

  useEffect(() => () => {
    if (spinTickRef.current) clearTimeout(spinTickRef.current)
    if (settleRef.current)   clearTimeout(settleRef.current)
  }, [])

  const resultProps = isSettled && round.result !== null ? (() => {
    const n = round.result!
    if (n === 0) return 'Zero · Green'
    return [
      `${n}`,
      round.resultColor === 'red' ? 'Red' : 'Black',
      n % 2 === 1 ? 'Odd' : 'Even',
      n <= 18 ? '1–18' : '19–36',
      n <= 12 ? '1st dozen' : n <= 24 ? '2nd dozen' : '3rd dozen',
    ].join(' · ')
  })() : null

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Roulette</span>
        <span className="text-sm text-zinc-600">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4 gap-4"
        entries={matchHistory}
        gameLabel="Roulette"
      >
        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}
        {/* Spinning ball */}
        <div className="relative flex items-center justify-center">
          {spinning && (
            <div className="absolute inset-0 rounded-full animate-ping border-2 border-white/20 scale-110" />
          )}
          <div className={`
            w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center transition-colors duration-300
            ${spinning && spinningPosition
              ? spinningPosition === '0'
                ? 'bg-emerald-700 border-emerald-400'
                : getNumberColor(parseInt(spinningPosition, 10)) === 'red'
                  ? 'bg-red-700 border-red-400'
                  : 'bg-zinc-600 border-zinc-400'
              : isSettled
                ? round.resultColor === 'red'   ? 'bg-red-700 border-red-400'
                : round.resultColor === 'black' ? 'bg-zinc-600 border-zinc-400'
                : 'bg-emerald-700 border-emerald-400'
              : 'bg-zinc-800/50 border-zinc-700'
            }
          `}>
            <span className={`text-2xl sm:text-3xl font-black tabular-nums transition-colors ${
              isSettled ? 'text-white' : spinning ? 'text-white/80' : 'text-zinc-600'
            }`}>
              {spinning ? spinningPosition ?? '?' : isSettled ? round.result : '?'}
            </span>
          </div>
        </div>

        {/* Roulette board grid */}
        <div className={`flex flex-col gap-0.5 ${!isBetting ? 'pointer-events-none' : ''}`}>
          {/* Zero */}
          {(() => {
            const isActive = currentTarget === '0' && currentBet === 0
            const isResult = isSettled && round.result === 0
            const isSpinning = spinningPosition === '0'
            return (
              <button
                type="button"
                onClick={() => selectTarget('0')}
                className={[
                  'relative h-6 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold text-white bg-emerald-700 transition-all duration-150 select-none',
                  isResult ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 shadow-lg shadow-white/20' : isActive ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-950' : isSpinning ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-zinc-950' : '',
                  isBetting && currentBet === 0 ? 'cursor-pointer hover:brightness-125 active:scale-95' : 'cursor-default',
                ].join(' ')}>
                0
              </button>
            )
          })()}

          {BOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-0.5">
              {row.map(n => {
                const nStr = String(n)
                const isActive = currentTarget === nStr && currentBet === 0
                const isResult = isSettled && round.result === n
                const isSpinning = spinningPosition === nStr
                const color = getNumberColor(n)
                const colorBase = color === 'red' ? 'bg-red-700' : color === 'black' ? 'bg-zinc-600' : 'bg-emerald-700'
                const ring = isResult
                  ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 scale-110 z-10 shadow-lg shadow-white/20'
                  : isActive
                    ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-950 z-10'
                    : isSpinning
                      ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-zinc-950'
                      : ''
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => selectTarget(nStr)}
                    className={[
                      'relative w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold text-white transition-all duration-150 select-none',
                      colorBase, ring,
                      isBetting && currentBet === 0 ? 'cursor-pointer hover:brightness-125 active:scale-90' : 'cursor-default',
                    ].join(' ')}>
                    {n}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {isSettled && resultProps && (
          <p className="text-[11px] text-zinc-500 text-center">{resultProps}</p>
        )}

        {/* New: Betting selection buttons below board */}
        {isBetting && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="flex gap-2 flex-wrap justify-center">
              {(['red', 'black'] as const).map(type => {
                const isActive = currentTarget === type && currentBet === 0
                return (
                  <button key={type} type="button" onClick={() => selectTarget(type)}
                    className={`${betBtnStyle(type, isActive, false)} px-3 py-1.5`}>
                    <span className="text-xs font-bold">{BET_LABELS[type]}</span>
                  </button>
                )
              })}
              {(['odd', 'even'] as const).map(type => {
                const isActive = currentTarget === type && currentBet === 0
                return (
                  <button key={type} type="button" onClick={() => selectTarget(type)}
                    className={`${betBtnStyle(type, isActive, false)} px-3 py-1.5`}>
                    <span className="text-xs font-bold">{BET_LABELS[type]}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-zinc-500 text-center">Click to select a tile to bet on</p>
          </div>
        )}
      </GameFieldWithHistory>

      {/* Control zone — fixed height, aligned with Wheel / other table shells */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 rounded-b-2xl flex flex-col justify-between py-3 h-[272px]">

        <div className={`flex-1 flex items-center justify-center transition-opacity duration-200 ${!isBetting ? 'opacity-25 pointer-events-none' : ''}`}>
          <div className="flex flex-nowrap justify-center gap-2">
            {CHIPS.map(chip => (
              <button key={chip.value} type="button" onClick={() => addChip(chip.value)}
                disabled={!currentTarget || chip.value > budget}
                className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}>
                {chip.label}
              </button>
            ))}
            <button type="button" onClick={() => addChip(Math.floor(bankroll / 4))}
              disabled={!currentTarget || currentBet >= bankroll || bankroll <= 0}
              className="h-12 px-3 rounded-full bg-blue-100 hover:bg-blue-50 border-2 border-blue-200 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
              ¼
            </button>
            <button type="button" onClick={() => addChip(Math.floor(bankroll / 2))}
              disabled={!currentTarget || currentBet >= bankroll || bankroll <= 0}
              className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
              ½
            </button>
            <button type="button" onClick={() => setCurrentBet(bankroll)}
              disabled={!currentTarget || currentBet >= bankroll || bankroll <= 0}
              className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
              All In
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {isBetting && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Bet</span>
                <span className="font-bold text-xl text-white tabular-nums">
                  {currentBet > 0 ? formatChips(currentBet) : '—'}
                </span>
              </div>
              {currentBet > 0 && currentTarget && (
                <p className="text-zinc-300 text-xs font-medium">
                  {getLabelForTarget(currentTarget)} · {getPayoutForTarget(currentTarget)}×
                </p>
              )}
              <button
                type="button"
                onClick={clearBet}
                className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${currentBet === 0 ? 'invisible' : ''}`}
              >
                Clear
              </button>
              {currentBet === 0 && (
                <p className="text-xs text-zinc-600 -mt-1">
                  {currentTarget ? 'Add chips to place bet' : 'Select a bet type'}
                </p>
              )}
            </div>
          )}
          {spinning && (
            <GameDockRandomQuote quoteIdx={quoteIdx} />
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-0.5">
                {pendingResult.tone === 'win' ? 'Win' : 'No win'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm flex flex-col gap-1">
            <div className="flex justify-center">
              {!isSettled ? (
                <button type="button" onClick={handleSpin} disabled={!canSpin || spinning}
                  className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
                  {spinning ? 'Spinning…' : 'Spin →'}
                </button>
              ) : (
                <button type="button" onClick={handleNext}
                  className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
                  Next →
                </button>
              )}
            </div>
            {minBet > 1 && isBetting && (
              <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
