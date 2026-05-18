'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import {
  cashOutChicken,
  advanceChickenRound,
  getChickenPayout,
  initChicken,
  startChickenRound,
} from '@/games/chicken-road/engine'
import type { ChickenState } from '@/games/chicken-road/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const MAX_STEPS = 10

interface ChickenResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface ChickenGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: ChickenResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

export function ChickenGame({ mode, bankroll, onResolve }: ChickenGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<ChickenState>(initChicken())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)

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
    setRound(startChickenRound(currentBet))
    setCurrentBet(0)
  }

  function handleAdvance() {
    const next = advanceChickenRound(round)
    setRound(next)
    if (next.stage === 'settled') {
      const po = getChickenPayout(next)
      onResolve({ outcome: next.outcome ?? 'loss', betAmount: next.betAmount, payout: po, multiplier: next.multiplier })
      const label = `−${formatChips(next.betAmount)}`
      setPendingResult({
        tone: 'loss', label,
        entry: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: label,
          subtitle: `${formatChips(next.betAmount)} bet · Bust step ${next.step}`,
          tone: 'loss',
        },
      })
    }
  }

  function handleCashOut() {
    const next = cashOutChicken(round)
    setRound(next)
    const po = getChickenPayout(next)
    onResolve({ outcome: 'win', betAmount: next.betAmount, payout: po, multiplier: next.multiplier })
    const netPL = po - next.betAmount
    const isPartial = po > 0 && po < next.betAmount
    const tone: MatchHistoryTone = isPartial ? 'partial' : 'win'
    const historyLabel = isPartial ? `−${formatChips(Math.abs(netPL))}` : `+${formatChips(netPL)}`
    setPendingResult({
      tone, label: formatChips(po),
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title: historyLabel,
        subtitle: `${formatChips(next.betAmount)} bet · Step ${next.step} · ${formatMultiplier(next.multiplier)}`,
        tone,
      },
    })
  }

  const handleNewRound = useCallback(() => {
    setRound(initChicken())
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    handleNewRound()
  }

  const currentStep = round.step

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Chicken Road</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 flex flex-col items-center justify-center px-4 py-6 md:px-6 gap-6"
        entries={matchHistory}
        gameLabel="Chicken"
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

        {/* Road visualization */}
        <div className="w-full">
          <div className="flex items-center gap-1 sm:gap-2 justify-center">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg flex-shrink-0 ${
              currentStep === 0 && !isSettled ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-white/5'
            }`}>
              🐔
            </div>
            {Array.from({ length: MAX_STEPS }, (_, i) => {
              const stepNum = i + 1
              const isPassed  = currentStep >= stepNum && !isSettled
              const isCurrent = currentStep === stepNum && isInProgress
              const isKilled  = isSettled && round.outcome === 'loss' && currentStep === stepNum
              const isSafe    = isSettled && round.outcome === 'win' && currentStep >= stepNum
              return (
                <div key={i} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <div className={`h-0.5 w-3 sm:w-5 rounded-full transition-colors ${isPassed || isSafe ? 'bg-emerald-400' : 'bg-white/15'}`} />
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                    isKilled  ? 'border-red-500 bg-red-600 text-white scale-110' :
                    isCurrent ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 scale-110' :
                    isSafe    ? 'border-emerald-500 bg-emerald-600/40 text-emerald-300' :
                    isPassed  ? 'border-emerald-500 bg-emerald-600/40 text-emerald-300' :
                    'border-white/20 bg-white/5 text-white/30'
                  }`}>
                    {isKilled ? '💥' : stepNum}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-white/30 mt-2 px-1">
            <span>Start</span>
            <span>Step {currentStep} / {MAX_STEPS}</span>
          </div>
        </div>

        {/* Stats — only visible during the game */}
        {(isInProgress || isSettled) && (
          <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Step</p>
              <p className="text-white font-semibold">{currentStep}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Multiplier</p>
              <p className="text-white font-semibold">{formatMultiplier(round.multiplier)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Potential</p>
              <p className="text-emerald-400 font-semibold text-sm">
                {round.betAmount > 0 ? formatChips(Math.round(round.betAmount * round.multiplier)) : '—'}
              </p>
            </div>
          </div>
        )}
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className="flex-1 flex flex-col items-center justify-start pt-3 gap-1 min-h-0">
          {isBetting && (
            <div className="w-full max-w-sm flex flex-col gap-1">
              <div className="flex flex-nowrap justify-center gap-2">
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
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-zinc-500 text-base">Bet</span>
                  <span className="font-bold text-xl text-white tabular-nums">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
                </div>
                <button type="button" onClick={() => setCurrentBet(0)}
                  className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${currentBet === 0 ? 'invisible' : ''}`}>
                  Clear
                </button>
              </div>
            </div>
          )}
          {isInProgress && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Bet</span>
              <span className="font-semibold text-white">{formatChips(round.betAmount)}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">Potential</span>
              <span className="font-semibold text-emerald-400">
                {formatChips(Math.round(round.betAmount * round.multiplier))}
              </span>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'loss' ? 'Squashed' : 'Cashed out'}
              </p>
              <p className={`text-3xl font-black tabular-nums ${
                pendingResult.tone === 'win' ? 'text-emerald-400' :
                pendingResult.tone === 'partial' ? 'text-amber-300' :
                'text-red-400'
              }`}>
                {pendingResult.label}
              </p>
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-sm flex flex-col gap-1 pb-2">
          {isBetting && (
            <div className="flex justify-center">
              <button type="button" onClick={handleStart} disabled={!canStart}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">
                Start →
              </button>
            </div>
          )}
          {isInProgress && (
            <div className="flex justify-center gap-2">
              <button type="button" onClick={handleAdvance}
                className="px-7 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors text-base shadow-lg">
                Advance →
              </button>
              <button type="button" onClick={handleCashOut}
                className="px-7 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-base shadow-lg">
                Cash Out
              </button>
            </div>
          )}
          {isSettled && pendingResult && (
            <div className="flex justify-center">
              <button type="button" onClick={handleNext}
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
