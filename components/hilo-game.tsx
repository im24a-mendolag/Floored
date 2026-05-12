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
import { getHiloPayout, initHilo, resolveHiloRound, startHiloRound } from '@/games/hilo/engine'
import type { HiloState } from '@/games/hilo/types'

const CHIPS = [
  { value: 10,  label: '$10',  bg: 'bg-red-600 hover:bg-red-500',        border: 'border-red-300' },
  { value: 25,  label: '$25',  bg: 'bg-emerald-600 hover:bg-emerald-500', border: 'border-emerald-300' },
  { value: 100, label: '$100', bg: 'bg-blue-600 hover:bg-blue-500',       border: 'border-blue-300' },
  { value: 500, label: '$500', bg: 'bg-zinc-700 hover:bg-zinc-600',       border: 'border-zinc-400' },
]

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

export function HiloGame({ mode, bankroll, onResolve }: HiloGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [safeZone, setSafeZone] = useState(40)
  const [round, setRound] = useState<HiloState>(initHilo())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [hiloToastOpen, setHiloToastOpen] = useState(false)
  const [hiloToastSnap, setHiloToastSnap] = useState<GameOutcomeToastSnap | null>(null)
  const lastHiloToastKey = useRef('')

  const payout      = useMemo(() => getHiloPayout(round), [round])
  const winChance   = useMemo(() => round.safeZone, [round.safeZone])
  const dangerChance = useMemo(() => 100 - round.safeZone, [round.safeZone])

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
    setRound(startHiloRound(currentBet, safeZone))
    setCurrentBet(0)
  }

  function handleRoll() {
    const next = resolveHiloRound(round)
    setRound(next)
    if (next.outcome) {
      const po = getHiloPayout(next)
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
        titlePrefix: `Roll ${next.rollResult}`,
      })
    }
  }

  const dismissHiloToast = useCallback(() => {
    setHiloToastOpen(false)
    setHiloToastSnap(null)
  }, [])

  const handleNewRound = useCallback(() => {
    setRound(initHilo())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  useEffect(() => {
    if (isBetting) lastHiloToastKey.current = ''
  }, [isBetting])

  useEffect(() => {
    if (!isSettled || !round.outcome) return
    const key = `${round.outcome}-${round.betAmount}-${round.rollResult}`
    if (lastHiloToastKey.current === key) return
    lastHiloToastKey.current = key
    const po = getHiloPayout(round)
    const title = round.outcome === 'win' ? 'Safe' : 'Danger'
    const subtitle = round.outcome === 'win' ? `+${formatChips(po)}` : `−${formatChips(round.betAmount)}`
    const tone = round.outcome === 'win' ? 'win' : 'loss'
    setHiloToastSnap({ title, subtitle, tone })
    setHiloToastOpen(true)
    queueMicrotask(() => handleNewRound())
  }, [isSettled, round.outcome, round.betAmount, round.rollResult, handleNewRound])

  const displaySafeZone = isBetting ? safeZone : round.safeZone

  return (
    <div className={GAME_CARD_FRAME} style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)' }}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Hi-Lo</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 p-4 md:p-6"
        entries={matchHistory}
        gameLabel="Hi-Lo"
      >

        {/* Roll result display */}
        <div className="flex items-center justify-center mb-6 min-h-[100px]">
          {round.rollResult !== null ? (
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-2xl text-4xl font-black ${
                round.outcome === 'win' ? 'bg-green-500 text-white' : round.outcome === 'loss' ? 'bg-red-500 text-white' : 'bg-white text-gray-900'
              }`}>
                {round.rollResult}
              </div>
              <p className="text-white/50 text-xs mt-2">Rolled</p>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center">
              <span className="text-3xl text-white/20">?</span>
            </div>
          )}
        </div>

        {/* Safe zone visualization */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Safe ({displaySafeZone}%)</span>
            <span>Danger ({100 - displaySafeZone}%)</span>
          </div>
          <div className="relative h-6 rounded-full overflow-hidden bg-red-900/50">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/70 transition-all duration-300"
              style={{ width: `${displaySafeZone}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/80">
              {displaySafeZone}% safe zone
            </div>
          </div>
        </div>

        {/* Config & stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <Slider
              label="Safe zone"
              min={10}
              max={90}
              step={1}
              value={safeZone}
              valueLabel={`${safeZone}%`}
              onChange={(e) => { if (isBetting) setSafeZone(Number(e.currentTarget.value)) }}
            />
          </div>
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Win chance</span>
              <span className="text-white font-semibold">{winChance}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Danger chance</span>
              <span className="text-white font-semibold">{dangerChance}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Payout</span>
              <span className="text-white font-semibold">{formatMultiplier(round.payoutMultiplier)}</span>
            </div>
          </div>
        </div>

      </GameFieldWithHistory>

      <GameOutcomeToast
        open={hiloToastOpen && !!hiloToastSnap}
        title={hiloToastSnap?.title ?? ''}
        subtitle={hiloToastSnap?.subtitle}
        tone={hiloToastSnap?.tone ?? 'neutral'}
        onDismiss={dismissHiloToast}
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
            <span className="text-white/50 text-sm">Bet <span className="text-white font-semibold">{formatChips(round.betAmount)}</span></span>
            <button onClick={handleRoll} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg">
              Roll
            </button>
          </div>
          </div>
        )}

      </div>
    </div>
  )
}
