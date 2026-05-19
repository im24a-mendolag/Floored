'use client'

import { useEffect, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { hiloNextCardRange } from '@/lib/survival/survival-perks'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useCurse } from '@/hooks/use-curse'
import type { HiLoCard, HiLoState } from '@/games/hilo/types'
import {
  cashOutHiLo,
  goAgainHiLo,
  guessHiLo,
  initHiLo,
  loseGame,
  startHiLoRound,
  streakMultiplier,
} from '@/games/hilo/engine'

const CARD_BACK = 'repeating-linear-gradient(45deg, #27272a, #27272a 4px, #1f1f23 4px, #1f1f23 8px)'

function isRed(suit: string) {
  return suit === '♥' || suit === '♦'
}

function CardView({
  card,
  faceDown = false,
  animClass = '',
}: {
  card: HiLoCard | null
  faceDown?: boolean
  animClass?: string
}) {
  if (!card || faceDown) {
    return (
      <div
        className="rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl flex items-center justify-center shrink-0"
        style={{ width: 80, height: 112 }}
      >
        {card && (
          <div className="rounded-lg border border-zinc-700" style={{ width: 56, height: 80, background: CARD_BACK }} />
        )}
      </div>
    )
  }

  const color = isRed(card.suit) ? 'text-red-600' : 'text-zinc-900'

  return (
    <div
      className={`rounded-xl bg-white shadow-2xl flex flex-col justify-between border border-zinc-200 select-none shrink-0 ${animClass}`}
      style={{ width: 80, height: 112, padding: 7 }}
    >
      <div className={`flex flex-col items-start leading-none ${color}`}>
        <span className="font-black text-lg leading-none">{card.rank}</span>
        <span className="text-base leading-none">{card.suit}</span>
      </div>
      <span className={`text-4xl leading-none self-center ${color}`}>{card.suit}</span>
      <div className={`flex flex-col items-start rotate-180 leading-none ${color}`}>
        <span className="font-black text-lg leading-none">{card.rank}</span>
        <span className="text-base leading-none">{card.suit}</span>
      </div>
    </div>
  )
}

function NextCardReveal({ card }: { card: HiLoCard | null }) {
  const [animClass, setAnimClass] = useState('')
  const prevCard = useRef<HiLoCard | null>(null)

  useEffect(() => {
    if (card && card !== prevCard.current) {
      setAnimClass('card-reveal')
      prevCard.current = card
      const t = setTimeout(() => setAnimClass(''), 350)
      return () => clearTimeout(t)
    }
    if (!card) prevCard.current = null
  }, [card])

  return <CardView card={card} faceDown={!card} animClass={animClass} />
}

interface HiLoResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface HiLoGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<HiLoResult>
}

interface PendingResult {
  tone: 'win' | 'loss'
  label: string
  outcomeLabel: string
  entry: MatchHistoryEntry
}

export function HiLoGame({ mode, bankroll, onBet, onResolve }: HiLoGameProps) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { hiloRange } = useSurvivalPerks('hilo')
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<HiLoState>(initHiLo)
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [currentCardAnim, setCurrentCardAnim] = useState('')

  const isBetting = round.stage === 'betting'
  const isPlaying = round.stage === 'playing'
  const isRiding = round.stage === 'riding'
  const isSettled = round.stage === 'settled'
  const canDeal = currentBet >= minBet && currentBet <= bankroll
  const showQuoteUntilNext = !isBetting
  const cashoutAmount = isRiding ? Math.round(round.betAmount * round.multiplier) : 0
  const nextRange =
    mode === 'survival' && hiloRange && (isPlaying || isRiding)
      ? hiloNextCardRange(round.deck)
      : null

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleDeal() {
    if (!canDeal || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setCurrentCardAnim('card-deal-in')
    setRound(startHiLoRound(bet))
    setTimeout(() => setCurrentCardAnim(''), 300)
  }

  function handleGuess(guess: 'higher' | 'lower') {
    if (!isPlaying && !isRiding) return
    const next = cursed ? loseGame(round, guess) : guessHiLo(round, guess)
    setRound(next)

    if (next.stage === 'settled') {
      const payout = 0
      const resolved = resolveGame(onResolve, {
        outcome: 'loss',
        betAmount: next.betAmount,
        payout,
        multiplier: 0,
      })
      const built = buildPendingResult(
        { outcome: 'loss', betAmount: next.betAmount, payout: resolved.payout },
        `${formatChips(next.betAmount)} bet · ${next.streak} hit${next.streak !== 1 ? 's' : ''} · Loss`,
        { winLabel: 'Total winnings', lossLabel: 'No winnings' },
      )
      setPendingResult({
        tone: 'loss',
        label: built.label,
        outcomeLabel: built.outcomeLabel,
        entry: built.entry,
      })
    }
    /* If 'riding', wait for player to cash out or go again */
  }

  function handleCashOut() {
    if (!isRiding) return
    const settled = cashOutHiLo(round)
    setRound(settled)
    const payout = Math.round(settled.betAmount * settled.multiplier)
    const resolved = resolveGame(onResolve, {
      outcome: 'win',
      betAmount: settled.betAmount,
      payout,
      multiplier: settled.multiplier,
    })
    const built = buildPendingResult(
      { outcome: 'win', betAmount: settled.betAmount, payout: resolved.payout },
      `${formatChips(settled.betAmount)} bet · ${settled.streak} streak · ${formatMultiplier(settled.multiplier)}`,
      { winLabel: 'Total winnings', lossLabel: 'No winnings' },
    )
    setPendingResult({
      tone: 'win',
      label: built.label,
      outcomeLabel: `${settled.streak}× streak · ${formatMultiplier(settled.multiplier)}`,
      entry: built.entry,
    })
  }

  function handleGoAgain() {
    if (!isRiding) return
    setRound(goAgainHiLo(round))
  }

  function handleNext() {
    unlock()
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    setCurrentCardAnim('')
    setRound(initHiLo())
    if (autoReBet && lastBet >= minBet && lastBet <= bankroll) setCurrentBet(lastBet)
    survivalAfterNext(mode)
  }

  /* Arrow indicator color */
  const arrowColor =
    isRiding ? 'text-emerald-400' :
    isSettled && round.outcome === 'win' ? 'text-emerald-400' :
    isSettled && round.outcome === 'loss' ? 'text-red-400' :
    'text-zinc-600'

  const guessArrow = round.lastGuess === 'higher' ? '↑' : round.lastGuess === 'lower' ? '↓' : '↕'

  const nextMult = isRiding ? streakMultiplier(round.streak + 1) : 0

  /* Flame count for streak display */
  const flames = '🔥'.repeat(Math.min(round.streak, 5))

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">HiLo</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-4 py-6 gap-5"
        entries={matchHistory}
        gameLabel="HiLo"
      >
        <GameDockBackButton mode={mode} visible={isBetting} />
        {nextRange && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Next card value {nextRange.min}–{nextRange.max}
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={!isBetting ? round.betAmount : 0}
          extra={isRiding ? `${round.streak}× streak` : undefined}
          visible={!isBetting && round.betAmount > 0}
        />

        {/* Streak indicator — always in DOM, invisible outside riding */}
        <div className={`flex items-center gap-2 text-sm font-bold text-yellow-300 ${!isRiding ? 'invisible' : ''}`}>
          <span>{flames}</span>
          <span>{round.streak}× streak · {formatMultiplier(round.multiplier)}</span>
        </div>

        {/* Card display */}
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Current</p>
            <CardView card={round.currentCard} faceDown={!round.currentCard} animClass={currentCardAnim} />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className={`text-4xl font-black transition-colors ${arrowColor}`}>{guessArrow}</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Next</p>
            <NextCardReveal card={round.nextCard} />
          </div>
        </div>

        {/* In-board guess buttons — visible during playing and riding */}
        <div className={`flex gap-4 ${(!isPlaying && !isRiding) ? 'invisible pointer-events-none' : ''}`}>
          <button
            type="button"
            onClick={() => handleGuess('higher')}
            disabled={isRiding}
            className="w-28 py-3 rounded-xl border-2 border-purple-600 bg-purple-950 hover:bg-purple-900 text-purple-200 font-bold text-sm uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none"
          >
            ↑ Higher
          </button>
          <button
            type="button"
            onClick={() => handleGuess('lower')}
            disabled={isRiding}
            className="w-28 py-3 rounded-xl border-2 border-purple-600 bg-purple-950 hover:bg-purple-900 text-purple-200 font-bold text-sm uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none"
          >
            ↓ Lower
          </button>
        </div>

        {/* Riding phase — cash out vs go again */}
        {isRiding && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCashOut}
              className="px-4 py-2.5 rounded-xl border-2 border-emerald-600 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold text-sm transition-all duration-150 hover:scale-105 active:scale-95"
            >
              Cash Out — {formatChips(cashoutAmount)}
            </button>
            <button
              type="button"
              onClick={handleGoAgain}
              className="px-4 py-2.5 rounded-xl border-2 border-yellow-600 bg-yellow-950 hover:bg-yellow-900 text-yellow-200 font-bold text-sm transition-all duration-150 hover:scale-105 active:scale-95"
            >
              Go Again → {formatMultiplier(nextMult)}
            </button>
          </div>
        )}

        <div className="min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
          <p className="text-center text-xs text-zinc-500">
            {isBetting
              ? 'Tie goes to the house · Ace counts high · Win streaks multiply your payout.'
              : isPlaying
                ? 'Pick Higher or Lower above.'
                : isRiding
                  ? 'Cash out or go again on the board.'
                  : '\u00A0'}
          </p>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || showQuoteUntilNext}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={showQuoteUntilNext}
            minBet={minBet}
          />

          <div className="h-10 flex items-center justify-center">
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isRiding && (
              <p className="text-sm text-zinc-400">
                Potential total winnings:{' '}
                <span className="font-semibold text-emerald-400">{formatChips(cashoutAmount)}</span>
              </p>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                outcomeLabel={pendingResult.outcomeLabel}
                label={pendingResult.label}
                tone={pendingResult.tone}
              />
            )}
            {!isBetting && !isRiding && !(isSettled && pendingResult) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className="flex justify-center">
            {isBetting ? (
              <button
                type="button"
                onClick={handleDeal}
                disabled={!canDeal}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Deal →
              </button>
            ) : isSettled ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Next →
              </button>
            ) : (
              <p className="min-w-[10.5rem] px-7 py-2 invisible select-none" aria-hidden>
                Deal →
              </p>
            )}
          </div>

          {minBet > 1 && isBetting && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
