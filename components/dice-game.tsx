'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { Slider } from '@/components/ui/slider'
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
  getPayoutMultiplier,
  getWinProbability,
  getPushProbability,
  initDice,
  resolveDiceRound,
  startDiceRound,
  getDiceResultPayout,
} from '@/games/dice/engine'
import type { DiceSide } from '@/games/dice/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

const SIDES: DiceSide[] = ['under', 'over']

interface DiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface DiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: DiceResult) => void
}

export function DiceGame({ mode, bankroll, onResolve }: DiceGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [threshold, setThreshold] = useState(7)
  const [side, setSide] = useState<DiceSide>('under')
  const [round, setRound] = useState(initDice())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [diceToastOpen, setDiceToastOpen] = useState(false)
  const [diceToastSnap, setDiceToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const lastDiceToastKey = useRef('')

  const chance     = useMemo(() => getWinProbability(threshold, side), [threshold, side])
  const pushChance = useMemo(() => getPushProbability(threshold), [threshold])
  const multiplier = useMemo(() => getPayoutMultiplier(threshold, side), [threshold, side])

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
    setRound(startDiceRound(currentBet, threshold, side))
    setCurrentBet(0)
  }

  const dismissDiceToast = useCallback(() => {
    setDiceToastOpen(false)
    setDiceToastSnap(null)
  }, [])

  const handleNewRound = useCallback(() => {
    setRound(initDice())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  useEffect(() => {
    if (isBetting) lastDiceToastKey.current = ''
  }, [isBetting])

  useEffect(() => {
    if (!isSettled || !round.outcome || round.rollResult == null) return
    const key = `${round.rollResult}-${round.outcome}-${round.betAmount}`
    if (lastDiceToastKey.current === key) return
    lastDiceToastKey.current = key
    const o = round.outcome
    const payout = getDiceResultPayout(round)
    const title = o === 'win' ? 'Win' : o === 'push' ? 'Push' : 'Loss'
    const subtitle =
      o === 'win'
        ? `+${formatChips(payout)}`
        : o === 'push'
          ? `${formatChips(round.betAmount)} returned`
          : `−${formatChips(round.betAmount)}`
    const tone = o === 'win' ? 'win' : o === 'push' ? 'push' : 'loss'
    setDiceToastSnap({ title, subtitle, tone })
    setDiceToastOpen(true)
    queueMicrotask(() => handleNewRound())
  }, [isSettled, round, round.rollResult, round.outcome, round.betAmount, handleNewRound])

  function handleRoll() {
    const next = resolveDiceRound(round)
    setRound(next)
    if (next.outcome) {
      const payout = getDiceResultPayout(next)
      onResolve({
        outcome: next.outcome,
        betAmount: next.betAmount,
        payout,
        multiplier: next.payoutMultiplier,
      })
      appendPlay(setMatchHistory, {
        bet: next.betAmount,
        payout,
        mult: next.payoutMultiplier,
        outcome: next.outcome,
        titlePrefix: `Roll ${next.rollResult}`,
      })
    }
  }

  return (
    <div className={GAME_CARD_FRAME} style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)' }}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Dice Over/Under</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 p-4 md:p-6"
        entries={matchHistory}
        gameLabel="Dice"
      >
        {/* Dice result display */}
        <div className="flex items-center justify-center mb-6 min-h-[120px] relative">
          {isSettled && round.rollResult !== null ? (
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-5xl font-black text-gray-900">{round.rollResult}</span>
              </div>
              <p className="text-white/50 text-sm">
                {round.threshold !== undefined
                  ? `${round.side === 'under' ? 'Under' : 'Over'} ${round.threshold}`
                  : ''}
              </p>
            </div>
          ) : isInProgress && round.rollResult !== null ? (
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-5xl font-black text-gray-900">{round.rollResult}</span>
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl border-2 border-white/20 bg-white/5 flex items-center justify-center mx-auto">
              <span className="text-4xl text-white/20">?</span>
            </div>
          )}

        </div>

        {isBetting && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <Slider
              label="Threshold"
              min={3}
              max={11}
              step={1}
              value={threshold}
              valueLabel={`${threshold}`}
              onChange={(e) => { if (isBetting) setThreshold(Number(e.currentTarget.value)) }}
            />
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Side</p>
              <div className="flex gap-2">
                {SIDES.map((option) => (
                  <button key={option} onClick={() => { if (isBetting) setSide(option) }}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
                      side === option ? 'bg-white text-gray-900' : 'bg-white/10 text-white/60 hover:bg-white/15'
                    } ${!isBetting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Win chance</span>
              <span className="text-white font-semibold">{(chance * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Push chance</span>
              <span className="text-white font-semibold">{(pushChance * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Payout</span>
              <span className="text-white font-semibold">{formatMultiplier(multiplier)}</span>
            </div>
          </div>
        </div>
        )}
      </GameFieldWithHistory>

      <GameOutcomeToast
        open={diceToastOpen && !!diceToastSnap}
        title={diceToastSnap?.title ?? ''}
        subtitle={diceToastSnap?.subtitle}
        tone={diceToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissDiceToast}
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
            <span className="text-white/50 text-sm">Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span></span>
            <button onClick={handleRoll} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg">
              Roll Dice
            </button>
          </div>
          </div>
        )}

      </div>
    </div>
  )
}
