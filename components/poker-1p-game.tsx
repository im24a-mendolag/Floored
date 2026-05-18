'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import {
  HAND_LABELS,
  HAND_PAYOUTS,
  dealHand,
  drawCards,
  initPoker,
  toggleHold,
} from '@/games/poker-1p/engine'
import type { Card, PokerHandRank, PokerState } from '@/games/poker-1p/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const HAND_ORDER: PokerHandRank[] = [
  'royal-flush', 'straight-flush', 'four-of-a-kind', 'full-house',
  'flush', 'straight', 'three-of-a-kind', 'two-pair', 'jacks-or-better',
]

interface PokerResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface Poker1pGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: PokerResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

function CardView({ card, held, isWinning, selectable, onToggle }: {
  card: Card
  held: boolean
  isWinning: boolean
  selectable: boolean
  onToggle: () => void
}) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  const color = isRed ? 'text-red-400' : 'text-zinc-100'
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!selectable}
      className={[
        'w-14 sm:w-16 h-[5.5rem] sm:h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-1 select-none transition-all duration-150',
        isWinning
          ? 'border-emerald-400 bg-emerald-400/10 scale-105 shadow-lg shadow-emerald-900/30'
          : held
            ? 'border-yellow-400 bg-yellow-400/10 scale-105 shadow-lg shadow-yellow-900/30'
            : 'border-zinc-600 bg-zinc-800',
        selectable ? 'cursor-pointer hover:border-zinc-400 hover:bg-zinc-700 active:scale-95' : 'cursor-default',
      ].join(' ')}
    >
      <span className={`text-xl sm:text-2xl font-black leading-none ${color}`}>{card.rank}</span>
      <span className={`text-2xl sm:text-3xl leading-none ${color}`}>{card.suit}</span>
      <span className={`text-[8px] font-bold text-yellow-400 tracking-widest ${held && !isWinning ? '' : 'invisible'}`}>
        HOLD
      </span>
    </button>
  )
}

const HAND_RANK_COLOR: Record<PokerHandRank, string> = {
  'royal-flush':     'text-yellow-300',
  'straight-flush':  'text-yellow-400',
  'four-of-a-kind':  'text-purple-400',
  'full-house':      'text-blue-400',
  'flush':           'text-green-400',
  'straight':        'text-teal-400',
  'three-of-a-kind': 'text-emerald-400',
  'two-pair':        'text-emerald-500',
  'jacks-or-better': 'text-emerald-600',
  'none':            'text-red-400',
}

export function Poker1pGame({ mode, bankroll, onResolve }: Poker1pGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [state, setState] = useState<PokerState>(initPoker)
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])

  const isBetting   = state.stage === 'betting'
  const isSelecting = state.stage === 'selecting'
  const isSettled   = state.stage === 'settled'
  const canDeal     = currentBet >= minBet && currentBet <= bankroll

  function addChip(v: number) {
    setCurrentBet(p => Math.min(p + v, bankroll))
  }

  function handleDeal() {
    if (!canDeal) return
    setLastBet(currentBet)
    setState(dealHand(currentBet))
    setCurrentBet(0)
    setPendingResult(null)
  }

  function handleToggleHold(index: number) {
    setState(prev => toggleHold(prev, index))
  }

  function handleDraw() {
    setState(prev => {
      const settled = drawCards(prev)
      resolveGame(settled)
      return settled
    })
  }

  function resolveGame(s: PokerState) {
    const payout = s.outcome === 'win' ? Math.round(s.betAmount * s.multiplier) : 0
    onResolve({ outcome: s.outcome!, betAmount: s.betAmount, payout, multiplier: s.multiplier })
    const net  = payout - s.betAmount
    const tone: MatchHistoryTone = s.outcome === 'win' ? 'win' : 'loss'
    const title = s.outcome === 'win' ? `+${formatChips(net)}` : `−${formatChips(s.betAmount)}`
    const label = s.outcome === 'win' ? formatChips(payout) : title
    setPendingResult({
      tone, label,
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title,
        subtitle: `${formatChips(s.betAmount)} · ${HAND_LABELS[s.handRank]}${s.multiplier > 0 ? ` · ${s.multiplier}×` : ''}`,
        tone,
      },
    })
  }

  const handleNext = useCallback(() => {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    setState(initPoker())
    setCurrentBet(autoReBet && lastBet <= bankroll ? lastBet : 0)
  }, [pendingResult, autoReBet, lastBet, bankroll])

  const heldCount = state.held.filter(Boolean).length
  const payout    = isSettled ? Math.round(state.betAmount * state.multiplier) : 0

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">1 Player Poker</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4 gap-4"
        entries={matchHistory}
        gameLabel="1 Player Poker"
      >
        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)}
            className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}

        {/* Pay table — shown during betting */}
        {isBetting && (
          <div className="w-full max-w-xs bg-zinc-900/60 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">Pay Table</p>
            </div>
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {HAND_ORDER.map(rank => (
                <div key={rank} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-zinc-400">{HAND_LABELS[rank]}</span>
                  <span className="text-xs font-bold text-zinc-200 tabular-nums">{HAND_PAYOUTS[rank]}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cards — shown during selecting and settled */}
        {(isSelecting || isSettled) && (
          <div className="flex flex-col items-center gap-3">
            {/* Hand rank badge — shown after draw */}
            <div className={`text-center min-h-[1.5rem] ${!isSettled ? 'invisible' : ''}`}>
              <p className={`text-base font-black tracking-wide ${HAND_RANK_COLOR[state.handRank]}`}>
                {HAND_LABELS[state.handRank]}
                {state.multiplier > 0 && ` — ${state.multiplier}×`}
              </p>
            </div>

            {/* Card row */}
            <div className="flex gap-2 sm:gap-2.5">
              {state.hand.map((card, i) => (
                <CardView
                  key={i}
                  card={card}
                  held={state.held[i] ?? false}
                  isWinning={isSettled && state.winningIndices.includes(i)}
                  selectable={isSelecting}
                  onToggle={() => handleToggleHold(i)}
                />
              ))}
            </div>

            <p className={`text-sm font-medium text-zinc-400 tracking-wide ${!isSelecting ? 'invisible' : ''}`}>
              Tap cards to hold · {heldCount} held · then draw
            </p>
          </div>
        )}
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className="flex flex-col gap-3 py-3">

          {/* Chip strip */}
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

          {/* Info row */}
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
            {isSelecting && (
              <p className="text-sm text-zinc-500">
                Bet {formatChips(state.betAmount)} · Hold cards, then draw
              </p>
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

          {/* Action button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={isSettled ? handleNext : isSelecting ? handleDraw : handleDeal}
              disabled={isBetting && !canDeal}
              className={[
                'min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg',
                isSettled && payout > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-zinc-800 disabled:text-zinc-600'
                  : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900',
              ].join(' ')}
            >
              {isSettled ? 'Next →' : isSelecting ? 'Draw →' : 'Deal →'}
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
