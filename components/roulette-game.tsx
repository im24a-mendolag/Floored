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
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import {
  BET_LABELS,
  BET_PAYOUTS,
  getLabelForTarget,
  getNumberColor,
  getPayoutForTarget,
  initRoulette,
  isNumberCoveredByBet,
  isNumberCoveredByTarget,
  spinRouletteMulti,
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

const SPIN_MS = 1800

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

function isHighlightedByBetsOrActive(
  n: number,
  bets: Record<string, number>,
  activeTarget: string | null,
): boolean {
  if (activeTarget !== null && isNumberCoveredByTarget(n, activeTarget)) return true
  for (const [target, amount] of Object.entries(bets)) {
    if (amount > 0 && isNumberCoveredByTarget(n, target)) return true
  }
  return false
}

function betBtnStyle(type: RouletteBetType, isActive: boolean, hasBet: boolean): string {
  const ring = isActive ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-900' : ''
  const base = `rounded-lg transition-all duration-150 flex flex-col items-center ${ring}`

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
  const [bets, setBets] = useState<Record<string, number>>({})
  const [activeTarget, setActiveTarget] = useState<string | null>(null)
  const [lastBets, setLastBets] = useState<Record<string, number>>({})
  const [activeBets, setActiveBets] = useState<Record<string, number>>({})
  const [spinning, setSpinning] = useState(false)
  const [displayNumber, setDisplayNumber] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const settleRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalBetAmount = Object.values(bets).reduce((a, b) => a + b, 0)
  const budget = bankroll - totalBetAmount
  const isBetting = round.stage === 'betting' && !spinning
  const isSettled = round.stage === 'settled' && !spinning
  const canSpin   = totalBetAmount >= minBet && totalBetAmount <= bankroll
  const activeTotalBet = Object.values(activeBets).reduce((a, b) => a + b, 0)
  const shouldDim = isBetting && (Object.keys(bets).length > 0 || activeTarget !== null)

  function selectTarget(target: string) {
    setActiveTarget(prev => prev === target ? null : target)
  }

  function addChip(value: number) {
    if (!activeTarget) return
    const capped = Math.min(value, budget)
    if (capped <= 0) return
    setBets(prev => ({ ...prev, [activeTarget]: (prev[activeTarget] ?? 0) + capped }))
  }

  function addAmount(amount: number) {
    if (!activeTarget) return
    const capped = Math.min(amount, budget)
    if (capped <= 0) return
    setBets(prev => ({ ...prev, [activeTarget]: (prev[activeTarget] ?? 0) + capped }))
  }

  function clearTargetBet(target: string) {
    setBets(prev => {
      const next = { ...prev }
      delete next[target]
      return next
    })
  }

  function handleSpin() {
    if (!canSpin || spinning) return

    const snapshot = { ...bets }
    const total = Object.values(snapshot).reduce((a, b) => a + b, 0)

    setLastBets(snapshot)
    setActiveBets(snapshot)
    setBets({})
    setActiveTarget(null)
    setPendingResult(null)

    const result = spinRouletteMulti(snapshot)
    setSpinning(true)

    intervalRef.current = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 37))
    }, 65)

    settleRef.current = setTimeout(() => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
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
      const betSummary = Object.entries(snapshot)
        .filter(([, amt]) => amt > 0)
        .map(([t, amt]) => `${getLabelForTarget(t)} ${formatChips(amt)}`)
        .join(' · ')

      setPendingResult({
        tone, label: displayLabel,
        entry: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: historyLabel,
          subtitle: `${formatChips(total)} · ${betSummary} · ${resultLabel}`,
          tone,
        },
      })
    }, SPIN_MS)
  }

  const handleNewRound = useCallback(() => {
    setRound(initRoulette())
    setPendingResult(null)
    setActiveBets({})
    if (autoReBet) {
      const totalLast = Object.values(lastBets).reduce((a, b) => a + b, 0)
      setBets(totalLast > 0 && totalLast <= bankroll ? lastBets : {})
    } else {
      setBets({})
    }
  }, [autoReBet, lastBets, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    handleNewRound()
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
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
        {(spinning || isSettled) && activeTotalBet > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(activeTotalBet)}</p>
          </div>
        )}

        {/* Spinning ball */}
        <div className="relative flex items-center justify-center">
          {spinning && (
            <div className="absolute inset-0 rounded-full animate-ping border-2 border-white/20 scale-110" />
          )}
          <div className={`
            w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center transition-colors duration-300
            ${spinning
              ? 'border-white/30 bg-zinc-800/70'
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
              {spinning ? displayNumber : isSettled ? round.result : '?'}
            </span>
          </div>
        </div>

        {/* Roulette board grid */}
        <div className={`flex flex-col gap-0.5 ${!isBetting ? 'pointer-events-none' : ''}`}>
          {/* Zero */}
          {(() => {
            const highlighted = isHighlightedByBetsOrActive(0, bets, activeTarget)
            const isActive = activeTarget === '0'
            const hasBet = (bets['0'] ?? 0) > 0
            const isResult = isSettled && round.result === 0
            return (
              <button
                type="button"
                onClick={() => selectTarget('0')}
                className={[
                  'relative h-6 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold text-white bg-emerald-700 transition-all duration-150 select-none',
                  isResult ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 shadow-lg shadow-white/20' : isActive ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-950' : '',
                  shouldDim && !highlighted ? 'opacity-20' : 'opacity-100',
                  isBetting ? 'cursor-pointer hover:brightness-125 active:scale-95' : 'cursor-default',
                ].join(' ')}>
                0
                {hasBet && !isResult && (
                  <span className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-yellow-400 rounded-full" />
                )}
              </button>
            )
          })()}

          {BOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-0.5">
              {row.map(n => {
                const nStr = String(n)
                const highlighted = isHighlightedByBetsOrActive(n, bets, activeTarget)
                const isActive = activeTarget === nStr
                const hasBet = (bets[nStr] ?? 0) > 0
                const isResult = isSettled && round.result === n
                const color = getNumberColor(n)
                const colorBase = color === 'red' ? 'bg-red-700' : color === 'black' ? 'bg-zinc-600' : 'bg-emerald-700'
                const ring = isResult
                  ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 scale-110 z-10 shadow-lg shadow-white/20'
                  : isActive
                    ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-950 z-10'
                    : ''
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => selectTarget(nStr)}
                    className={[
                      'relative w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold text-white transition-all duration-150 select-none',
                      colorBase, ring,
                      shouldDim && !highlighted ? 'opacity-20' : 'opacity-100',
                      isBetting ? 'cursor-pointer hover:brightness-125 active:scale-90' : 'cursor-default',
                    ].join(' ')}>
                    {n}
                    {hasBet && !isResult && (
                      <span className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-yellow-400 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {isSettled && resultProps && (
          <p className="text-[11px] text-zinc-500 text-center">{resultProps}</p>
        )}
      </GameFieldWithHistory>

      {/* Fixed-height dock */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 rounded-b-2xl h-[320px] flex flex-col justify-between py-4">

        {/* Slot 1: Bet type selector */}
        <div className={`flex flex-col gap-1.5 items-center ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
          {/* Colors */}
          <div className="flex gap-1.5 justify-center">
            {(['red', 'black', 'green'] as const).map(type => {
              const isActive = activeTarget === type
              const hasBet = (bets[type] ?? 0) > 0
              return (
                <button key={type} type="button" onClick={() => selectTarget(type)}
                  className={`${betBtnStyle(type, isActive, hasBet)} px-3 py-1.5`}>
                  <span className="text-xs font-bold">{BET_LABELS[type]} {BET_PAYOUTS[type]}×</span>
                  <span className={`text-[9px] font-medium tabular-nums mt-0.5 ${hasBet ? 'text-yellow-300' : 'opacity-0'}`}>
                    {formatChips(bets[type] ?? 0)}
                  </span>
                </button>
              )
            })}
          </div>
          {/* Even money */}
          <div className="flex gap-1.5 justify-center">
            {(['odd', 'even', 'low', 'high'] as const).map(type => {
              const isActive = activeTarget === type
              const hasBet = (bets[type] ?? 0) > 0
              return (
                <button key={type} type="button" onClick={() => selectTarget(type)}
                  className={`${betBtnStyle(type, isActive, hasBet)} px-2.5 py-1.5`}>
                  <span className="text-xs font-bold">{BET_LABELS[type]} {BET_PAYOUTS[type]}×</span>
                  <span className={`text-[9px] font-medium tabular-nums mt-0.5 ${hasBet ? 'text-yellow-300' : 'opacity-0'}`}>
                    {formatChips(bets[type] ?? 0)}
                  </span>
                </button>
              )
            })}
          </div>
          {/* Dozens */}
          <div className="flex gap-1.5 justify-center">
            {(['dozen1', 'dozen2', 'dozen3'] as const).map(type => {
              const isActive = activeTarget === type
              const hasBet = (bets[type] ?? 0) > 0
              return (
                <button key={type} type="button" onClick={() => selectTarget(type)}
                  className={`${betBtnStyle(type, isActive, hasBet)} px-2.5 py-1.5`}>
                  <span className="text-xs font-bold">{BET_LABELS[type]} {BET_PAYOUTS[type]}×</span>
                  <span className={`text-[9px] font-medium tabular-nums mt-0.5 ${hasBet ? 'text-yellow-300' : 'opacity-0'}`}>
                    {formatChips(bets[type] ?? 0)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Slot 2: Chips */}
        <div className={`flex flex-nowrap justify-center gap-2 ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
          {CHIPS.map(chip => (
            <button key={chip.value} type="button" onClick={() => addChip(chip.value)}
              disabled={!activeTarget || chip.value > budget}
              className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}>
              {chip.label}
            </button>
          ))}
          <button type="button" onClick={() => addAmount(Math.floor(bankroll / 4))}
            disabled={!activeTarget || budget <= 0}
            className="h-12 px-3 rounded-full bg-blue-100 hover:bg-blue-50 border-2 border-blue-200 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
            ¼
          </button>
          <button type="button" onClick={() => addAmount(Math.floor(bankroll / 2))}
            disabled={!activeTarget || budget <= 0}
            className="h-12 px-3 rounded-full bg-blue-50 hover:bg-white border-2 border-blue-100 text-blue-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
            ½
          </button>
          <button type="button" onClick={() => addAmount(budget)}
            disabled={!activeTarget || budget <= 0}
            className="h-12 px-3 rounded-full bg-white hover:bg-zinc-50 border-2 border-zinc-200 text-zinc-900 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100">
            All In
          </button>
        </div>

        {/* Slot 3: Info display */}
        <div className="flex flex-col items-center justify-center gap-1">
          {isBetting && (
            <>
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Total</span>
                <span className="font-bold text-xl text-white tabular-nums">
                  {totalBetAmount > 0 ? formatChips(totalBetAmount) : '—'}
                </span>
              </div>
              {activeTarget ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-zinc-300 font-medium">{getLabelForTarget(activeTarget)}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">{getPayoutForTarget(activeTarget)}×</span>
                  {(bets[activeTarget] ?? 0) > 0 && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-yellow-400 tabular-nums">{formatChips(bets[activeTarget] ?? 0)}</span>
                      <button type="button"
                        onClick={() => clearTargetBet(activeTarget)}
                        className="ml-0.5 text-zinc-600 hover:text-red-400 transition-colors leading-none text-sm">
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">
                  {totalBetAmount > 0 ? 'Select a target to add chips' : 'Select a bet type or number'}
                </p>
              )}
              {totalBetAmount > 0 && (
                <button type="button"
                  onClick={() => { setBets({}); setActiveTarget(null) }}
                  className="text-xs text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-600 rounded px-2 py-0.5 transition-colors mt-0.5">
                  Clear all
                </button>
              )}
            </>
          )}
          {spinning && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Bet</span>
              <span className="font-semibold text-white">{formatChips(activeTotalBet)}</span>
              <span className="text-zinc-700">·</span>
              <span className="italic">Spinning…</span>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? 'Win' : 'No win'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Slot 4: Action button */}
        <div className="flex flex-col items-center gap-1">
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
          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
