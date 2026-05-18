'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import {
  CHICKENS,
  PAYOUT_MULTIPLIER,
  RACE_TICKS,
  TICK_MS,
  generateRaceFrames,
  initChickenRace,
  settleRace,
  startRace,
} from '@/games/chicken-race/engine'
import type { ChickenRaceState } from '@/games/chicken-race/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

interface ChickenRaceResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface ChickenRaceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: ChickenRaceResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

export function ChickenRaceGame({ mode, bankroll, onResolve }: ChickenRaceGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [state, setState] = useState<ChickenRaceState>(initChickenRace)
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [lastPicked, setLastPicked] = useState<number | null>(null)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [progress, setProgress] = useState<number[]>(CHICKENS.map(() => 0))

  const raceFramesRef = useRef<number[][]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isBetting = state.stage === 'betting'
  const isRacing  = state.stage === 'racing'
  const isSettled = state.stage === 'settled'
  const canRace   = state.pickedChicken !== null && currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function selectChicken(id: number) {
    if (!isBetting) return
    setState(prev => ({ ...prev, pickedChicken: prev.pickedChicken === id ? null : id }))
  }

  function handleRace() {
    if (!canRace || state.pickedChicken === null) return
    const next = startRace(currentBet, state.pickedChicken)
    setLastBet(currentBet)
    setLastPicked(state.pickedChicken)
    setCurrentBet(0)
    setPendingResult(null)
    setProgress(CHICKENS.map(() => 0))
    raceFramesRef.current = generateRaceFrames(next.winner!)
    setState(next)

    let tick = 0
    tickRef.current = setInterval(() => {
      const frame = raceFramesRef.current[tick]
      if (frame) setProgress([...frame])
      tick++
      if (tick >= RACE_TICKS) {
        clearInterval(tickRef.current!)
        tickRef.current = null
        setProgress([...raceFramesRef.current[RACE_TICKS - 1]!])
        setState(prev => {
          const settled = settleRace(prev)
          resolveGame(settled)
          return settled
        })
      }
    }, TICK_MS)
  }

  function resolveGame(settled: ChickenRaceState) {
    const won = settled.pickedChicken === settled.winner
    const payout = won ? Math.round(settled.betAmount * PAYOUT_MULTIPLIER) : 0
    onResolve({ outcome: settled.outcome!, betAmount: settled.betAmount, payout, multiplier: won ? PAYOUT_MULTIPLIER : 0 })
    const net = payout - settled.betAmount
    const tone: MatchHistoryTone = won ? 'win' : 'loss'
    const title = won ? `+${formatChips(net)}` : `−${formatChips(settled.betAmount)}`
    const label = won ? formatChips(payout) : title
    setPendingResult({
      tone, label,
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title,
        subtitle: `${formatChips(settled.betAmount)} on ${CHICKENS[settled.pickedChicken!]!.name} · ${CHICKENS[settled.winner!]!.name} won`,
        tone,
      },
    })
  }

  const handleNext = useCallback(() => {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    const next = initChickenRace()
    if (autoReBet && lastBet <= bankroll && lastPicked !== null) {
      setState({ ...next, pickedChicken: lastPicked })
      setCurrentBet(lastBet)
    } else {
      setState(next)
    }
    setProgress(CHICKENS.map(() => 0))
  }, [pendingResult, autoReBet, lastBet, lastPicked, bankroll])

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current) }, [])

  const actionDisabled = isRacing || (isBetting && !canRace)

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Chicken Race</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4"
        entries={matchHistory}
        gameLabel="Chicken Race"
      >
        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}
        {isRacing && state.pickedChicken !== null && (
          <div className="absolute left-2 top-2 z-10 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2.5 py-1.5 text-xs shadow">
            <div style={{ color: CHICKENS[state.pickedChicken]!.color }}>{CHICKENS[state.pickedChicken]!.name}</div>
            <div className="text-white font-semibold">{formatChips(state.betAmount)}</div>
          </div>
        )}

        <div className="flex flex-col gap-2.5 w-full max-w-sm">
          {/* Payout label above all chickens */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Pick your chicken</span>
            <span className="text-sm font-bold text-zinc-300 tabular-nums">{PAYOUT_MULTIPLIER.toFixed(2)}×</span>
          </div>

          {/* Race lanes — fixed height always so layout never shifts */}
          {CHICKENS.map(chicken => {
            const isSelected = state.pickedChicken === chicken.id
            const isWinner   = isSettled && state.winner === chicken.id
            const isLoser    = isSettled && state.winner !== chicken.id
            const prog       = progress[chicken.id] ?? 0

            return (
              <button
                key={chicken.id}
                type="button"
                disabled={!isBetting}
                onClick={() => selectChicken(chicken.id)}
                className={[
                  'w-full rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150',
                  isBetting
                    ? isSelected
                      ? 'bg-yellow-400/10 border-yellow-400 cursor-pointer'
                      : 'bg-zinc-800/60 border-zinc-700 hover:border-zinc-500 cursor-pointer'
                    : isWinner
                      ? 'border-2'
                      : isLoser
                        ? 'bg-zinc-900/40 border-zinc-800 opacity-40'
                        : 'bg-zinc-800/60 border-zinc-700',
                ].join(' ')}
                style={isWinner ? { borderColor: chicken.color, backgroundColor: `${chicken.color}18` } : undefined}
              >
                {/* Name row — fixed layout, "Winner!" takes space always */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">🐔</span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: isSelected ? '#facc15' : isWinner ? chicken.color : undefined }}
                    >
                      {chicken.name}
                    </span>
                  </div>
                  {/* Winner badge — always takes space, invisible when not winner */}
                  <span
                    className={`text-xs font-semibold ${isWinner ? '' : 'invisible'}`}
                    style={{ color: chicken.color }}
                  >
                    Winner!
                  </span>
                </div>

                {/* Track — always rendered, emoji always present (invisible during betting) */}
                <div className="relative">
                  <div className="h-2.5 rounded-full bg-zinc-700/60 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${prog}%`, backgroundColor: chicken.color, transition: 'none' }}
                    />
                  </div>
                  <div
                    className={`absolute -top-1 text-base leading-none pointer-events-none ${isBetting ? 'invisible' : ''}`}
                    style={{ left: `calc(${prog}% - 10px)`, transition: 'none' }}
                  >
                    🐔
                  </div>
                </div>
                {/* Spacer for emoji overflow — always present so card height never changes */}
                <div className="h-4" />
              </button>
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
            {isRacing && <p className="text-sm text-zinc-500 italic">Race in progress…</p>}
            {isSettled && pendingResult && (
              <div className="flex items-center gap-3">
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {pendingResult.tone === 'win' ? 'Win' : 'No win'}
                </p>
                <p className={`text-2xl font-black tabular-nums ${pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pendingResult.label}
                </p>
              </div>
            )}
          </div>

          {/* Single action button — always in same position, label/handler changes per phase */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={isSettled ? handleNext : handleRace}
              disabled={actionDisabled}
              className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
            >
              {isSettled ? 'Next →' : 'Race →'}
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
