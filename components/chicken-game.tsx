'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  cashOutChicken,
  advanceChickenRound,
  getChickenPayout,
  initChicken,
  startChickenRound,
} from '@/games/chicken-road/engine'
import type { ChickenState } from '@/games/chicken-road/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
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

export function ChickenGame({ mode, bankroll, onResolve }: ChickenGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<ChickenState>(initChicken())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [chickenToastOpen, setChickenToastOpen] = useState(false)
  const [chickenToastSnap, setChickenToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const lastChickenToastKey = useRef('')

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
    setRound(startChickenRound(currentBet))
    setCurrentBet(0)
  }

  function handleAdvance() {
    const next = advanceChickenRound(round)
    setRound(next)
    if (next.stage === 'settled') {
      const po = getChickenPayout(next)
      onResolve({
        outcome: next.outcome ?? 'loss',
        betAmount: next.betAmount,
        payout: po,
        multiplier: next.multiplier,
      })
      appendPlay(setMatchHistory, {
        bet: next.betAmount,
        payout: po,
        mult: next.multiplier,
        outcome: 'loss',
        titlePrefix: `Busted · step ${next.step}`,
      })
    }
  }

  function handleCashOut() {
    const next = cashOutChicken(round)
    setRound(next)
    const po = getChickenPayout(next)
    onResolve({
      outcome: 'win',
      betAmount: next.betAmount,
      payout: po,
      multiplier: next.multiplier,
    })
    appendPlay(setMatchHistory, {
      bet: next.betAmount,
      payout: po,
      mult: next.multiplier,
      outcome: 'win',
      titlePrefix: `Cash out · step ${next.step}`,
    })
  }

  const dismissChickenToast = useCallback(() => {
    setChickenToastOpen(false)
    setChickenToastSnap(null)
  }, [])

  const handleNewRound = useCallback(() => {
    setRound(initChicken())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  useEffect(() => {
    if (isBetting) lastChickenToastKey.current = ''
  }, [isBetting])

  useEffect(() => {
    if (!isSettled || !round.outcome) return
    const step = round.step
    const key = `${round.outcome}-${round.betAmount}-${step}`
    if (lastChickenToastKey.current === key) return
    lastChickenToastKey.current = key
    const title = round.outcome === 'win' ? 'Cashed out' : 'Squashed'
    const subtitle =
      round.outcome === 'win'
        ? `+${formatChips(getChickenPayout(round))}`
        : `−${formatChips(round.betAmount)}`
    const tone = round.outcome === 'win' ? 'win' : 'loss'
    setChickenToastSnap({ title, subtitle, tone })
    setChickenToastOpen(true)
    queueMicrotask(() => handleNewRound())
  }, [isSettled, round, round.outcome, round.betAmount, round.step, handleNewRound])

  const currentStep = round.step

  return (
    <div className={GAME_CARD_FRAME} style={{ background: 'linear-gradient(160deg, #2a1a00 0%, #1a1000 100%)' }}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Chicken Road</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 p-4 md:p-6"
        entries={matchHistory}
        gameLabel="Chicken"
      >

        {/* Road visualization */}
        <div className="mb-6">
          <div className="flex items-center gap-1 sm:gap-2 justify-center">
            {/* Start */}
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg flex-shrink-0 ${
              currentStep === 0 && !isSettled ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-white/5'
            }`}>
              🐔
            </div>

            {/* Steps */}
            {Array.from({ length: MAX_STEPS }, (_, i) => {
              const stepNum = i + 1
              const isPassed  = currentStep >= stepNum && !isSettled
              const isCurrent = currentStep === stepNum && isInProgress
              const isKilled  = isSettled && round.outcome === 'loss' && currentStep === stepNum
              const isSafe    = isSettled && round.outcome === 'win' && currentStep >= stepNum

              return (
                <div key={i} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {/* connector line */}
                  <div className={`h-0.5 w-3 sm:w-5 rounded-full transition-colors ${
                    isPassed || isSafe ? 'bg-emerald-400' : 'bg-white/15'
                  }`} />
                  {/* step node */}
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Step</p>
            <p className="text-white font-semibold">{currentStep}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Multiplier</p>
            <p className="text-white font-semibold">{formatMultiplier(round.multiplier)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">If cashed</p>
            <p className="text-emerald-400 font-semibold text-sm">
              {round.betAmount > 0 ? formatChips(Math.round(round.betAmount * round.multiplier)) : '—'}
            </p>
          </div>
        </div>

      </GameFieldWithHistory>

      <GameOutcomeToast
        open={chickenToastOpen && !!chickenToastSnap}
        title={chickenToastSnap?.title ?? ''}
        subtitle={chickenToastSnap?.subtitle}
        tone={chickenToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissChickenToast}
      />

      <div className={GAME_CONTROL_DOCK_S}>
        {isBetting && (
          <div className="relative z-10">
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            {CHIPS.map((chip) => (
              <button key={chip.value} onClick={() => addChip(chip.value)} disabled={chip.value > bankroll - currentBet}
                className={`w-14 h-14 rounded-full ${chip.bg} ${chip.border} border-2 text-white font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed`}>
                {chip.label}
              </button>
            ))}
            <button
              onClick={() => setCurrentBet(bankroll)}
              disabled={currentBet >= bankroll || bankroll <= 0}
              className="h-14 px-3 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 border-2 border-amber-300 text-black font-bold text-xs shadow-lg transition-transform active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              All In
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="text-white/50 text-sm">Bet</span>
              <span className="font-bold text-lg">{currentBet > 0 ? formatChips(currentBet) : '—'}</span>
              {currentBet > 0 && <button onClick={() => setCurrentBet(0)} className="text-white/35 text-xs hover:text-white/70 ml-1 transition-colors">✕ Clear</button>}
            </div>
            <button onClick={handleStart} disabled={!canStart}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/25 text-black font-bold rounded-lg text-sm shadow-lg transition-all">
              Start →
            </button>
          </div>
          {minBet > 1 && <p className="text-white/25 text-xs mt-1">Min bet: {formatChips(minBet)}</p>}
          </div>
        )}

        {isInProgress && (
          <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-white/50 text-sm">
              Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span>
            </span>
            <div className="flex gap-2">
              <button onClick={handleAdvance} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-sm transition-colors shadow-lg">
                Advance →
              </button>
              <button onClick={handleCashOut} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition-colors shadow-lg">
                Cash Out
              </button>
            </div>
          </div>
          </div>
        )}

      </div>
    </div>
  )
}
