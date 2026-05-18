'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import { pickQuote } from '@/lib/gambling-quotes'
import { getSlotsResultPayout, initSlots, PAYTABLE, spinSlots } from '@/games/slots/engine'
import type { SlotsState, SlotsSymbol } from '@/games/slots/types'

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

const SYMBOL_DISPLAY: Record<SlotsSymbol, { glyph: string; color: string; bg: string }> = {
  cherry:  { glyph: '🍒', color: 'text-red-400',    bg: 'bg-red-950/60' },
  bar:     { glyph: 'BAR', color: 'text-amber-300',  bg: 'bg-amber-950/60' },
  bell:    { glyph: '🔔', color: 'text-yellow-300',  bg: 'bg-yellow-950/60' },
  diamond: { glyph: '◆',  color: 'text-cyan-300',   bg: 'bg-cyan-950/60' },
  seven:   { glyph: '7',  color: 'text-yellow-400',  bg: 'bg-yellow-900/60' },
  wild:    { glyph: '★',  color: 'text-purple-300',  bg: 'bg-purple-950/60' },
}

const PAYTABLE_GLYPH: Record<SlotsSymbol, string> = {
  cherry: '🍒', bar: 'BAR', bell: '🔔', diamond: '◆', seven: '7', wild: '★',
}

const SPIN_DURATION = 700   // all reels spinning
const STAGGER       = 250   // delay between each reel landing
const LAND_FLASH    = 350   // landing animation duration per reel

interface SlotsResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface SlotsGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: SlotsResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  isJackpot: boolean
  entry: MatchHistoryEntry
}

type ReelTuple = [SlotsSymbol | null, SlotsSymbol | null, SlotsSymbol | null]
type BoolTuple  = [boolean, boolean, boolean]

function Reel({ symbol, spinning, landed }: { symbol: SlotsSymbol | null; spinning: boolean; landed: boolean }) {
  const display = symbol ? SYMBOL_DISPLAY[symbol] : null
  const isBar   = symbol === 'bar'
  const isSeven = symbol === 'seven'

  return (
    <div className={`
      relative w-24 h-28 sm:w-28 sm:h-32 rounded-xl border-2 flex items-center justify-center overflow-hidden
      ${spinning ? 'border-white/30 bg-black/40' : 'border-white/20 bg-black/30'}
      transition-colors duration-200
    `}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-yellow-400/30 pointer-events-none" />
      <div className={`
        flex items-center justify-center w-full h-full
        ${spinning ? 'slot-reel-spinning' : ''}
        ${landed && !spinning ? 'slot-reel-landing' : ''}
      `}>
        {spinning || !display ? (
          <span className="text-4xl text-white/20">·</span>
        ) : (
          <div className={`flex flex-col items-center justify-center rounded-lg px-2 py-1 ${display.bg}`}>
            <span className={`
              ${isBar ? 'text-2xl font-black tracking-tight' : 'text-4xl'}
              ${isSeven ? 'text-5xl font-black' : ''}
              ${display.color} leading-none select-none
            `}>
              {display.glyph}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function SlotsGame({ mode, bankroll, onResolve }: SlotsGameProps) {
  const router = useRouter()
  const { floorMinBet, jackpotMeter, runActive, resetJackpotMeter } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1
  const jackpotReady = mode === 'survival' && runActive && jackpotMeter >= 100

  const [round, setRound] = useState<SlotsState>(initSlots())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  // Per-reel animation state
  const [isSpinning, setIsSpinning]       = useState(false)
  const [spinningReels, setSpinningReels] = useState<BoolTuple>([false, false, false])
  const [landedReels, setLandedReels]     = useState<BoolTuple>([false, false, false])
  const [displayedReels, setDisplayedReels] = useState<ReelTuple>([null, null, null])

  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const isBetting = !isSpinning && round.stage === 'betting'
  const isSettled = !isSpinning && round.stage === 'settled'
  const canSpin   = currentBet >= minBet && currentBet <= bankroll

  useEffect(() => {
    return () => animTimers.current.forEach(clearTimeout)
  }, [])

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleSpin() {
    if (!canSpin || isSpinning) return

    animTimers.current.forEach(clearTimeout)
    animTimers.current = []

    const bet = currentBet
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setIsSpinning(true)
    setSpinningReels([true, true, true])
    setLandedReels([false, false, false])
    setDisplayedReels([null, null, null])

    const result = spinSlots(bet, jackpotReady)

    // Reel 0 lands
    const t1 = setTimeout(() => {
      setSpinningReels([false, true, true])
      setDisplayedReels([result.reels![0], null, null])
      setLandedReels([true, false, false])
    }, SPIN_DURATION)

    const t2 = setTimeout(() => setLandedReels([false, false, false]), SPIN_DURATION + LAND_FLASH)

    // Reel 1 lands
    const t3 = setTimeout(() => {
      setSpinningReels([false, false, true])
      setDisplayedReels([result.reels![0], result.reels![1], null])
      setLandedReels([false, true, false])
    }, SPIN_DURATION + STAGGER)

    const t4 = setTimeout(() => setLandedReels([false, false, false]), SPIN_DURATION + STAGGER + LAND_FLASH)

    // Reel 2 lands
    const t5 = setTimeout(() => {
      setSpinningReels([false, false, false])
      setDisplayedReels([result.reels![0], result.reels![1], result.reels![2]])
      setLandedReels([false, false, true])
    }, SPIN_DURATION + STAGGER * 2)

    // Commit result after last reel's flash
    const t6 = setTimeout(() => {
      setLandedReels([false, false, false])
      setIsSpinning(false)
      setRound(result)

      if (jackpotReady) resetJackpotMeter()

      const payout = getSlotsResultPayout(result)
      onResolve({ outcome: result.outcome ?? 'loss', betAmount: result.betAmount, payout, multiplier: result.payoutMultiplier })

      const r = result.reels!
      const line = `${PAYTABLE_GLYPH[r[0]]} ${PAYTABLE_GLYPH[r[1]]} ${PAYTABLE_GLYPH[r[2]]}`
      const isWin = result.outcome === 'win'
      const netPL = payout - result.betAmount
      const isPartial = isWin && netPL < 0
      const tone: MatchHistoryTone = !isWin ? 'loss' : isPartial ? 'partial' : 'win'
      const historyLabel = !isWin
        ? `−${formatChips(result.betAmount)}`
        : isPartial
          ? `−${formatChips(Math.abs(netPL))}`
          : `+${formatChips(netPL)}`
      const displayLabel = isWin ? formatChips(payout) : historyLabel
      const titlePrefix = result.isJackpotSpin ? 'Jackpot' : line
      setPendingResult({
        tone, label: displayLabel,
        isJackpot: !!result.isJackpotSpin,
        entry: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          at: new Date(),
          title: historyLabel,
          subtitle: isWin
            ? `${formatChips(result.betAmount)} bet · ${titlePrefix} · ${result.payoutMultiplier}×`
            : `${formatChips(result.betAmount)} bet · No match`,
          tone,
        },
      })
    }, SPIN_DURATION + STAGGER * 2 + LAND_FLASH)

    animTimers.current = [t1, t2, t3, t4, t5, t6]
  }

  const handleNewRound = useCallback(() => {
    setRound(initSlots())
    setDisplayedReels([null, null, null])
    setLandedReels([false, false, false])
    setSpinningReels([false, false, false])
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    handleNewRound()
  }

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Slots</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 flex flex-col items-center justify-center px-4 py-4 md:px-6 gap-4"
        entries={matchHistory}
        gameLabel="Slots"
      >
        {isBetting && (
          <button onClick={() => router.push(`/${mode}`)} className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}

        {/* Jackpot meter — survival only */}
        {mode === 'survival' && runActive && (
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
              <span className="uppercase tracking-wider">Jackpot Meter</span>
              <span className={`font-semibold ${jackpotReady ? 'text-yellow-400 animate-pulse' : 'text-white/60'}`}>
                {jackpotReady ? 'READY — Next spin is 100×!' : `${jackpotMeter}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${jackpotReady ? 'bg-yellow-400' : 'bg-gradient-to-r from-purple-600 to-yellow-400'}`}
                style={{ width: `${jackpotMeter}%` }}
              />
            </div>
          </div>
        )}

        {/* Reels */}
        <div className="flex items-center justify-center gap-3">
          <Reel symbol={displayedReels[0]} spinning={spinningReels[0]} landed={landedReels[0]} />
          <div className="relative">
            <Reel symbol={displayedReels[1]} spinning={spinningReels[1]} landed={landedReels[1]} />
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-xs">▶</div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-xs">◀</div>
          </div>
          <Reel symbol={displayedReels[2]} spinning={spinningReels[2]} landed={landedReels[2]} />
        </div>

        {/* Paytable — hidden while spinning */}
        {!isSpinning && (
          <div className="w-full max-w-sm">
            <p className="text-white/25 text-xs uppercase tracking-wider mb-2">Paytable</p>
            <div className="grid grid-cols-2 gap-1">
              {PAYTABLE.map((row) => (
                <div key={row.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5">
                  <div className="flex items-center gap-1.5">
                    {row.symbols.slice(0, row.label.startsWith('Two') || row.label.startsWith('Double') ? 2 : 3).map((s, i) => (
                      <span key={i} className={`font-bold text-xs ${SYMBOL_DISPLAY[s].color}`}>
                        {PAYTABLE_GLYPH[s]}
                      </span>
                    ))}
                  </div>
                  <span className={`font-bold text-sm ${row.multiplier >= 25 ? 'text-yellow-400' : row.multiplier >= 10 ? 'text-emerald-400' : 'text-white/60'}`}>
                    {row.multiplier}×
                  </span>
                </div>
              ))}
              <div className="flex items-center px-3 py-1.5 rounded-lg bg-purple-900/30 border border-purple-700/30">
                <span className="text-purple-300 text-xs font-semibold">★ Wild — any</span>
              </div>
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
          {isSpinning && (
            <GameDockRandomQuote quoteIdx={quoteIdx} />
          )}
          {isSettled && pendingResult && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                {pendingResult.tone === 'win' ? (pendingResult.isJackpot ? 'Jackpot' : 'Win') : pendingResult.tone === 'partial' ? 'Partial return' : 'No match'}
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
          {(isBetting || isSpinning) && (
            <div className="flex justify-center">
              <button type="button" onClick={handleSpin} disabled={!canSpin || isSpinning}
                className={`min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg ${
                  jackpotReady && !isSpinning
                    ? 'bg-yellow-400 hover:bg-yellow-300 text-black animate-pulse'
                    : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900'
                }`}>
                {isSpinning ? 'Spinning…' : jackpotReady ? '★ Spin ★' : 'Spin →'}
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
