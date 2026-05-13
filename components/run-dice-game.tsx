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
import {
  getRunDicePayout,
  initRunDice,
  rollRunDice,
  startRunDiceRound,
} from '@/games/run-dice/engine'
import type { RunDiceConfig, RunDiceState } from '@/games/run-dice/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

const DICE_WEIGHT: Record<number, number> = {2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1}

interface RunDiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface RunDiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  config?: RunDiceConfig
  onResolve: (result: RunDiceResult) => void
}

export function RunDiceGame({ mode, bankroll, config, onResolve }: RunDiceGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<RunDiceState>(initRunDice(config))
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [runDiceToastOpen, setRunDiceToastOpen] = useState(false)
  const [runDiceToastSnap, setRunDiceToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const lastRunDiceToastKey = useRef('')

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
    setRound(startRunDiceRound(currentBet, round.config))
    setCurrentBet(0)
  }

  function handleRoll() {
    const next = rollRunDice(round)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      const po = getRunDicePayout(next)
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout: po,
        multiplier: next.payoutMultiplier,
      })
      appendPlay(setMatchHistory, {
        bet: next.betAmount,
        payout: po,
        mult: next.payoutMultiplier,
        outcome: next.outcome,
        titlePrefix: next.rollResult != null ? `Roll ${next.rollResult}` : 'Settled',
      })
    }
  }

  const dismissRunDiceToast = useCallback(() => {
    setRunDiceToastOpen(false)
    setRunDiceToastSnap(null)
  }, [])

  const handleNewRound = useCallback(() => {
    setRound(initRunDice(config))
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll, config])

  useEffect(() => {
    if (isBetting) lastRunDiceToastKey.current = ''
  }, [isBetting])

  useEffect(() => {
    if (!isSettled || !round.outcome) return
    const key = `${round.outcome}-${round.betAmount}-${round.rollResult}-${round.rollCount}`
    if (lastRunDiceToastKey.current === key) return
    lastRunDiceToastKey.current = key
    const o = round.outcome
    const title = o === 'win' ? 'Win' : o === 'push' ? 'Push' : 'Loss'
    const subtitle =
      o === 'win'
        ? `+${formatChips(getRunDicePayout(round))}`
        : o === 'push'
          ? `${formatChips(round.betAmount)} returned`
          : `−${formatChips(round.betAmount)}`
    const tone = o === 'win' ? 'win' : o === 'push' ? 'push' : 'loss'
    setRunDiceToastSnap({ title, subtitle, tone })
    setRunDiceToastOpen(true)
    queueMicrotask(() => handleNewRound())
  }, [isSettled, round, round.outcome, round.betAmount, round.rollResult, round.rollCount, handleNewRound])

  function outcomeColor(val: number): string {
    if (round.config.win.includes(val))     return 'bg-emerald-700/80 border-emerald-500 text-emerald-200'
    if (round.config.loss.includes(val))    return 'bg-red-900/80 border-red-700 text-red-300'
    return 'bg-white/10 border-white/20 text-white/50'
  }

  const lastRoll = round.rollResult

  return (
    <div className={GAME_CARD_FRAME} style={{ background: 'linear-gradient(160deg, #2a1500 0%, #1a0d00 100%)' }}>
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

        {/* Dice result display */}
        <div className="flex items-center justify-center mb-5 min-h-[100px]">
          {lastRoll !== null ? (
            <div className="text-center">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-2xl text-4xl font-black ${
                round.config.win.includes(lastRoll)  ? 'bg-emerald-500 text-white' :
                round.config.loss.includes(lastRoll) ? 'bg-red-600 text-white' :
                'bg-white text-gray-900'
              }`}>
                {lastRoll}
              </div>
              <p className="text-white/40 text-xs mt-2">
                {round.config.win.includes(lastRoll) ? 'Win roll' : round.config.loss.includes(lastRoll) ? 'Loss roll' : 'Neutral'}
              </p>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
              <span className="text-4xl text-white/20">?</span>
            </div>
          )}
        </div>

        {/* Dice value grid (2–12) */}
        <div>
          <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Outcome map</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i + 2).map((val) => (
              <div key={val} className={`rounded-md border px-1 py-2 text-center text-xs font-bold transition-all ${outcomeColor(val)} ${
                lastRoll === val ? 'ring-2 ring-yellow-400 scale-110 shadow-lg' : ''
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

      </GameFieldWithHistory>

      <GameOutcomeToast
        open={runDiceToastOpen && !!runDiceToastSnap}
        title={runDiceToastSnap?.title ?? ''}
        subtitle={runDiceToastSnap?.subtitle}
        tone={runDiceToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissRunDiceToast}
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
              Roll →
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
              <span className="text-white/30 mx-2">·</span>
              <span className="text-white/50">{round.rollCount}/3 rolls used</span>
            </span>
            <button onClick={handleRoll} disabled={isSettled}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold rounded-lg text-sm transition-colors shadow-lg">
              Roll
            </button>
          </div>
          </div>
        )}

      </div>
    </div>
  )
}
