'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import {
  cashOut,
  flipAgain,
  initCoinFlip,
  startFlip,
} from '@/games/coin-flip/engine'
import type { CoinFlipState, CoinSide } from '@/games/coin-flip/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

interface CoinFlipResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface CoinFlipGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: CoinFlipResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

export function CoinFlipGame({ mode, bankroll, onResolve }: CoinFlipGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [state, setState] = useState<CoinFlipState>(initCoinFlip)
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  // 'idle' | 'spinning' | 'landing'
  const [coinAnim, setCoinAnim] = useState<'idle' | 'spinning' | 'landing'>('idle')
  const pendingFlipRef = useRef<CoinFlipState | null>(null)
  const lastPickRef   = useRef<CoinSide | null>(null)
  const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t2Ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isBetting  = state.stage === 'betting'
  const isRiding   = state.stage === 'riding'
  const isSettled  = state.stage === 'settled'
  const isFlipping = coinAnim !== 'idle'
  const canFlip    = currentBet >= minBet && currentBet <= bankroll && state.pick !== null

  const cashoutAmount = isRiding ? Math.round(state.betAmount * state.multiplier) : 0

  function addChip(v: number) {
    setCurrentBet(p => Math.min(p + v, bankroll))
  }

  function handlePickSide(side: CoinSide) {
    if (isFlipping) return
    lastPickRef.current = side
    if (isBetting) setState(prev => ({ ...prev, pick: side }))
    else if (isRiding) setState(prev => ({ ...prev, nextPick: side }))
  }

  // Auto-select last pick when autoReBet is on and we're waiting for a pick
  useEffect(() => {
    if (!autoReBet || isFlipping || !lastPickRef.current) return
    if (isRiding && !state.nextPick)
      setState(prev => ({ ...prev, nextPick: lastPickRef.current }))
  }, [state.stage, state.streak, isRiding, isFlipping, autoReBet, state.nextPick])

  function resolveGame(s: CoinFlipState) {
    const payout = s.outcome === 'win' ? Math.round(s.betAmount * s.multiplier) : 0
    onResolve({ outcome: s.outcome!, betAmount: s.betAmount, payout, multiplier: s.outcome === 'win' ? s.multiplier : 0 })
    const net   = payout - s.betAmount
    const tone: MatchHistoryTone = s.outcome === 'win' ? 'win' : 'loss'
    const title = s.outcome === 'win' ? `+${formatChips(net)}` : `−${formatChips(s.betAmount)}`
    const label = s.outcome === 'win' ? formatChips(payout) : title
    setPendingResult({
      tone, label,
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title,
        subtitle: `${formatChips(s.betAmount)} · ${s.outcome === 'win' ? `${s.multiplier}× (${s.streak}× streak)` : 'Loss'}`,
        tone,
      },
    })
  }

  function triggerFlip(next: CoinFlipState) {
    pendingFlipRef.current = next
    setCoinAnim('spinning')
    t1Ref.current = setTimeout(() => {
      setCoinAnim('landing')
      const result = pendingFlipRef.current!
      setState(result)
      if (result.stage === 'settled') resolveGame(result)
      t2Ref.current = setTimeout(() => setCoinAnim('idle'), 600)
    }, 650)
  }

  function handleFlip() {
    if (!canFlip || !state.pick || isFlipping) return
    const next = startFlip(currentBet, state.pick)
    setLastBet(currentBet)
    setCurrentBet(0)
    setPendingResult(null)
    triggerFlip(next)
  }

  function handleFlipAgain() {
    if (!state.nextPick || isFlipping) return
    triggerFlip(flipAgain(state))
  }

  function handleCashOut() {
    if (isFlipping) return
    const next = cashOut(state)
    setState(next)
    resolveGame(next)
  }

  const handleNext = useCallback(() => {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    setState({ ...initCoinFlip(), pick: autoReBet ? lastPickRef.current : null })
    setCoinAnim('idle')
    setCurrentBet(autoReBet && lastBet <= bankroll ? lastBet : 0)
  }, [pendingResult, autoReBet, lastBet, bankroll])

  const coinAnimClass = coinAnim === 'spinning' ? 'coin-spinning' : coinAnim === 'landing' ? 'coin-landing' : ''

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Coin Flip</span>
        <span className="text-sm text-zinc-600">{isFlipping ? 'Flipping…' : state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-6 gap-5"
        entries={matchHistory}
        gameLabel="Coin Flip"
      >
        {isBetting && !isFlipping && (
          <button onClick={() => router.push(`/${mode}`)}
            className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}

        {/* Coin visual — always in DOM */}
        <div className={[
          'w-44 h-44 rounded-full border-[5px] flex flex-col items-center justify-center shadow-xl',
          coinAnimClass,
          state.lastResult === 'heads'
            ? 'border-yellow-400 bg-yellow-400/15'
            : state.lastResult === 'tails'
              ? 'border-zinc-400 bg-zinc-400/10'
              : 'border-zinc-700 bg-zinc-800/50',
        ].join(' ')}>
          <span className="text-7xl leading-none">🪙</span>
          <span className={[
            'text-xs font-bold uppercase tracking-widest mt-2 transition-opacity duration-200',
            isFlipping ? 'opacity-0' : 'opacity-100',
            state.lastResult === 'heads' ? 'text-yellow-400'
              : state.lastResult === 'tails' ? 'text-zinc-300'
              : 'text-transparent',
          ].join(' ')}>
            {state.lastResult ?? 'flip'}
          </span>
        </div>

        {/* Streak indicator — always in DOM, invisible outside riding */}
        <div className={`flex items-center gap-2 text-sm font-bold text-yellow-300 ${(!isRiding || isFlipping) ? 'invisible' : ''}`}>
          <span>{'🔥'.repeat(Math.min(state.streak, 5))}</span>
          <span>{state.streak}× streak · {state.multiplier}× multiplier</span>
        </div>

        {/* Heads / Tails selector — always in DOM, invisible when settled or flipping */}
        <div className={`flex gap-4 ${(isSettled || isFlipping) ? 'invisible pointer-events-none' : ''}`}>
          {(['heads', 'tails'] as CoinSide[]).map(side => {
            const isActive = isBetting ? state.pick === side : state.nextPick === side
            return (
              <button
                key={side}
                type="button"
                onClick={() => handlePickSide(side)}
                className={[
                  'w-24 h-14 rounded-xl border-2 font-bold text-sm uppercase tracking-wider transition-all duration-150',
                  isActive
                    ? 'bg-yellow-400/15 border-yellow-400 text-yellow-300'
                    : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white',
                ].join(' ')}
              >
                {side === 'heads' ? 'Heads' : 'Tails'}
              </button>
            )
          })}
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className="flex flex-col gap-3 py-3">

          {/* Chip strip */}
          <div className={`flex flex-nowrap justify-center gap-2 ${(!isBetting || isFlipping) ? 'invisible pointer-events-none' : ''}`}>
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

          {/* Info row */}
          <div className="h-10 flex items-center justify-center">
            {isBetting && !isFlipping && (
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
            {isFlipping && (
              <p className="text-sm text-zinc-500 italic tracking-wide">Flipping the coin…</p>
            )}
            {isRiding && !isFlipping && (
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 text-base">Cash out</span>
                <span className="font-bold text-xl text-emerald-400 tabular-nums">{formatChips(cashoutAmount)}</span>
                <span className="text-xs text-zinc-500">{state.multiplier}×</span>
              </div>
            )}
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

          {/* Action row — Cash Out always in DOM (invisible when not riding) + main button */}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleCashOut}
              disabled={isFlipping}
              className={[
                'min-w-[8rem] px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-base shadow-lg disabled:opacity-50',
                !isRiding ? 'invisible pointer-events-none' : '',
              ].join(' ')}
            >
              Cash Out — {formatChips(cashoutAmount)}
            </button>
            <button
              type="button"
              onClick={isSettled ? handleNext : isRiding ? handleFlipAgain : handleFlip}
              disabled={(isBetting && !canFlip) || (isRiding && !state.nextPick) || isFlipping}
              className="min-w-[8rem] px-5 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
            >
              {isSettled ? 'Next →' : isRiding ? 'Flip Again →' : 'Flip →'}
            </button>
          </div>

          {minBet > 1 && isBetting && !isFlipping && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
