'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_CARD_SHELL,
  GAME_BOARD_ARENA,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import { pickQuote } from '@/lib/gambling-quotes'
import {
  getRunDicePayout,
  initRunDice,
  rollRunDice,
  startRunDiceRound,
} from '@/games/run-dice/engine'
import type { RunDiceConfig, RunDiceState } from '@/games/run-dice/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const DICE_WEIGHT: Record<number, number> = {2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1}

// Reveal steps during animation: 0=both spinning, 1=d1 landed, 2=d2 landed, 3=total shown
type RevealStep = 0 | 1 | 2 | 3

interface RunDiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface PendingResult {
  tone: 'win' | 'loss' | 'push'
  label: string
  entry: MatchHistoryEntry
}

interface RunDiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  config?: RunDiceConfig
  onResolve: (result: RunDiceResult) => void
}

export function RunDiceGame({ mode, bankroll, config, onResolve }: RunDiceGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<RunDiceState>(initRunDice(config))
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  // Animation state
  const [isRolling, setIsRolling] = useState(false)
  const [spinDice, setSpinDice] = useState<[number, number]>([1, 1])
  const [revealStep, setRevealStep] = useState<RevealStep>(0)
  const [targetDice, setTargetDice] = useState<[number, number] | null>(null)
  const [targetTotal, setTargetTotal] = useState<number | null>(null)
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearAnimTimers() {
    if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null }
    animTimeoutsRef.current.forEach(clearTimeout)
    animTimeoutsRef.current = []
  }

  useEffect(() => () => clearAnimTimers(), [])

  const winChance = useMemo(() => {
    const total = round.config.win.reduce((sum, v) => sum + (DICE_WEIGHT[v] ?? 0), 0)
    return total / 36
  }, [round.config.win])

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
    setQuoteIdx((prev) => pickQuote(prev))
    setRound(startRunDiceRound(currentBet, round.config))
    setCurrentBet(0)
    setTargetDice(null)
    setTargetTotal(null)
  }

  function handleRoll() {
    if (isRolling) return
    clearAnimTimers()

    const next = rollRunDice(round)

    // Snapshot target values for the animation to reveal
    setTargetDice(next.dice)
    setTargetTotal(next.rollResult)
    setIsRolling(true)
    setRevealStep(0)
    setSpinDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])

    // Cycle random values every 65ms during the spin phase
    spinIntervalRef.current = setInterval(() => {
      setSpinDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])
    }, 65)

    // t1: stop cycling, land die 1
    const t1 = setTimeout(() => {
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null }
      setRevealStep(1)
    }, 550)

    // t2: land die 2
    const t2 = setTimeout(() => setRevealStep(2), 790)

    // t3: reveal total
    const t3 = setTimeout(() => setRevealStep(3), 990)

    // t4: commit state, handle settled
    const t4 = setTimeout(() => {
      setIsRolling(false)
      setRevealStep(0)
      setRound(next)

      if (next.stage === 'settled' && next.outcome) {
        const po = getRunDicePayout(next)
        onResolve({ outcome: next.outcome, betAmount: next.betAmount, payout: po, multiplier: next.payoutMultiplier })
        const o = next.outcome
        const tone = o === 'win' ? 'win' : o === 'push' ? 'push' : 'loss'
        const historyLabel =
          o === 'win'  ? `+${formatChips(po - next.betAmount)}` :
          o === 'push' ? `Push` :
          `−${formatChips(next.betAmount)}`
        const displayLabel = o === 'win' ? formatChips(po) : historyLabel
        const entry: MatchHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: historyLabel,
          subtitle: next.rollResult != null
            ? `${formatChips(next.betAmount)} bet · Roll ${next.rollResult}${o === 'win' ? ` · ${formatMultiplier(next.payoutMultiplier)}` : ''}`
            : `${formatChips(next.betAmount)} bet · Settled`,
          tone,
        }
        setPendingResult({ tone, label: displayLabel, entry })
      }
    }, 1220)

    animTimeoutsRef.current = [t1, t2, t3, t4]
  }

  const handleNewRound = useCallback(() => {
    clearAnimTimers()
    setRound(initRunDice(config))
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
    setTargetDice(null)
    setTargetTotal(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReBet, lastBet, bankroll, config])

  function handleNextRoll() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    handleNewRound()
  }

  function outcomeColor(val: number): string {
    if (round.config.win.includes(val))  return 'bg-emerald-700/80 border-emerald-500 text-emerald-200'
    if (round.config.loss.includes(val)) return 'bg-red-900/80 border-red-700 text-red-300'
    return 'bg-white/10 border-white/20 text-white/50'
  }

  function dieColor(total: number): string {
    if (round.config.win.includes(total))  return 'bg-emerald-500 border-emerald-300 text-white'
    if (round.config.loss.includes(total)) return 'bg-red-600 border-red-400 text-white'
    return 'bg-zinc-200 border-zinc-300 text-zinc-900'
  }

  const lastRoll = round.rollResult
  const lastDice = round.dice
  // Outcome color is revealed only when the total appears (step 3); until then keep neutral
  const neutralDie = 'bg-zinc-200 border-zinc-300 text-zinc-900'
  const tColor = revealStep >= 3 && targetTotal != null ? dieColor(targetTotal) : neutralDie

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Run Dice</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 p-4 md:p-6"
        entries={matchHistory}
        gameLabel="Run Dice"
      >

        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}

        {/* Dice result display */}
        <div className="flex items-center justify-center mb-5 min-h-[100px]">
          {isRolling ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">

                {/* Die 1 */}
                {revealStep === 0 ? (
                  <div key="spin-d1" className="w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 bg-zinc-200 border-zinc-300 text-zinc-900 dice-rolling">
                    {spinDice[0]}
                  </div>
                ) : (
                  <div key="land-d1" className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${tColor} dice-landing`}>
                    {targetDice?.[0]}
                  </div>
                )}

                <span className="text-white/30 text-xl font-bold">+</span>

                {/* Die 2 */}
                {revealStep < 2 ? (
                  <div key="spin-d2" className="w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 bg-zinc-200 border-zinc-300 text-zinc-900 dice-rolling">
                    {spinDice[1]}
                  </div>
                ) : (
                  <div key="land-d2" className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${tColor} dice-landing`}>
                    {targetDice?.[1]}
                  </div>
                )}

                <span className="text-white/30 text-xl font-bold">=</span>

                {/* Total */}
                {revealStep >= 3 ? (
                  <div key="land-total" className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${tColor} card-reveal`}>
                    {targetTotal}
                  </div>
                ) : (
                  <div key="spin-total" className="w-16 h-16 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
                    <span className="text-3xl text-white/20">?</span>
                  </div>
                )}

              </div>
              <p className="text-white/40 text-xs h-4">
                {revealStep < 3 ? 'Rolling…' : (
                  targetTotal != null && (
                    round.config.win.includes(targetTotal)  ? 'Win roll' :
                    round.config.loss.includes(targetTotal) ? 'Loss roll' :
                    'Neutral — re-rolling'
                  )
                )}
              </p>
            </div>
          ) : lastDice !== null && lastRoll !== null ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${dieColor(lastRoll)}`}>
                  {lastDice[0]}
                </div>
                <span className="text-white/30 text-xl font-bold">+</span>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${dieColor(lastRoll)}`}>
                  {lastDice[1]}
                </div>
                <span className="text-white/30 text-xl font-bold">=</span>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${dieColor(lastRoll)}`}>
                  {lastRoll}
                </div>
              </div>
              <p className="text-white/40 text-xs h-4">
                {round.config.win.includes(lastRoll)  ? 'Win roll' :
                 round.config.loss.includes(lastRoll) ? 'Loss roll' :
                 'Neutral — re-rolling'}
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
                <span className="text-3xl text-white/20">?</span>
              </div>
              <div className="w-16 h-16 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
                <span className="text-3xl text-white/20">?</span>
              </div>
            </div>
          )}
        </div>

        {/* Dice value grid (2–12) */}
        <div>
          <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Outcome map</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i + 2).map((val) => (
              <div key={val} className={`rounded-md border px-1 py-2 text-center text-xs font-bold transition-all ${outcomeColor(val)} ${
                lastRoll === val && !isRolling ? 'ring-2 ring-yellow-400 scale-110 shadow-lg' : ''
              }`}>
                <p className="text-[10px] leading-none opacity-60 mb-0.5">{val}</p>
                <p className="leading-none">
                  {round.config.win.includes(val) ? 'W' : round.config.loss.includes(val) ? 'L' : 'N'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Win chance</p>
            <p className="text-white font-semibold text-sm">{(winChance * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Payout</p>
            <p className="text-white font-semibold text-sm">{formatMultiplier(round.payoutMultiplier)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Rolls</p>
            <p className="text-white font-semibold text-sm">{round.rollCount} / 3</p>
          </div>
        </div>

        {/* How to play */}
        <div className="mt-4 border-t border-white/5 pt-3 space-y-0.5 text-center">
          <p className="text-white/25 text-xs">Roll 2 dice · <span className="text-emerald-500/50">W</span> wins payout · <span className="text-red-500/50">L</span> loses bet · <span className="text-white/25">N</span> re-rolls (up to 3×)</p>
          <p className="text-white/25 text-xs">Three neutral rolls = push · bet returned</p>
        </div>

      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        {/* Top: chips during betting, outcome after settled */}
        <div className="flex-1 flex flex-col items-center justify-start pt-3 gap-1 min-h-0">
          {isBetting && (
            <div className="w-full max-w-sm flex flex-col gap-1">
              <div className="flex flex-nowrap justify-center gap-2">
                {CHIPS.map((chip) => (
                  <button key={chip.value} onClick={() => addChip(chip.value)} disabled={chip.value > bankroll - currentBet}
                    className={`w-12 h-12 rounded-full ${chip.cls} border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100`}>
                    {chip.label}
                  </button>
                ))}
                <button
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
                  onClick={() => setCurrentBet(0)}
                  className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${currentBet === 0 ? 'invisible' : ''}`}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {isInProgress && (
            <div className="flex flex-1 flex-col items-center justify-center px-2 pb-1">
              <GameDockRandomQuote quoteIdx={quoteIdx} />
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? 'Win' : pendingResult.tone === 'push' ? 'Push' : 'Loss'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${
                pendingResult.tone === 'win' ? 'text-green-400' :
                pendingResult.tone === 'push' ? 'text-zinc-300' : 'text-red-400'
              }`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        {/* Bottom: action buttons */}
        <div className="mx-auto w-full max-w-sm flex flex-col gap-1 pb-2">
          {isBetting && (
            <div className="flex justify-center">
              <button onClick={handleStart} disabled={!canStart}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
                Roll →
              </button>
            </div>
          )}
          {isInProgress && (
            <div className="flex justify-center">
              <button onClick={handleRoll} disabled={isRolling}
                className="min-w-[10.5rem] px-7 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-base transition-colors shadow-lg">
                {isRolling ? 'Rolling…' : 'Roll'}
              </button>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="flex justify-center">
              <button onClick={handleNextRoll}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
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
