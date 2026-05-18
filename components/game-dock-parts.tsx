'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { formatChips } from '@/utils/format'

/** Standard chip denominations — copy across games via import. */
export const GAME_CHIPS = [
  { value: 10, label: '$10', cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25, label: '$25', cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
] as const

/** Inner wrapper for GAME_CONTROL_DOCK_M — evenly spaced rows. */
export const GAME_DOCK_INNER = 'flex min-h-[188px] flex-col justify-between py-3'

const CHIP_BTN =
  'w-12 h-12 rounded-full border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100'

const FRAC_BTN =
  'h-12 px-3 rounded-full border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100'

export function GameDockBackButton({
  mode,
  visible,
}: {
  mode: 'freeplay' | 'survival'
  visible: boolean
}) {
  const router = useRouter()
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={() => router.push(`/${mode}`)}
      className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors"
    >
      ← Back
    </button>
  )
}

export function GameActiveBetBadge({
  betAmount,
  betType,
  extra,
  visible = true,
}: {
  betAmount: number
  betType?: string
  extra?: string
  visible?: boolean
}) {
  if (!visible || betAmount <= 0) return null
  return (
    <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg max-w-[min(12rem,45vw)]">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
      <p className="text-sm font-bold text-white tabular-nums">{formatChips(betAmount)}</p>
      {betType && <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{betType}</p>}
      {extra && <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{extra}</p>}
    </div>
  )
}

export function GameDockBetRow({
  currentBet,
  onClear,
}: {
  currentBet: number
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-zinc-500 text-base">Bet</span>
      <span className="font-bold text-xl text-white tabular-nums">
        {currentBet > 0 ? formatChips(currentBet) : '—'}
      </span>
      {currentBet > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-0.5 text-xs font-medium rounded border border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-white transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export function GameDockSettledRow({
  outcomeLabel,
  label,
  tone,
}: {
  outcomeLabel: string
  label: string
  tone: 'win' | 'loss'
}) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{outcomeLabel}</p>
      <p
        className={`text-2xl font-black tabular-nums ${tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {label}
      </p>
    </div>
  )
}

export function GameDockChipRow({
  visible,
  bankroll,
  currentBet,
  onAddChip,
  quoteIdx,
  showQuote = false,
}: {
  visible: boolean
  bankroll: number
  currentBet: number
  onAddChip: (value: number) => void
  quoteIdx?: number
  showQuote?: boolean
}) {
  return (
    <div
      className={`flex flex-nowrap justify-center items-center gap-2 min-h-12 ${!visible ? 'invisible pointer-events-none' : ''}`}
    >
      {showQuote && quoteIdx !== undefined ? (
        <GameDockRandomQuote quoteIdx={quoteIdx} />
      ) : (
        <>
          {GAME_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => onAddChip(chip.value)}
              disabled={chip.value > bankroll - currentBet}
              className={`${CHIP_BTN} ${chip.cls}`}
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAddChip(Math.floor(bankroll / 4))}
            disabled={currentBet >= bankroll || bankroll <= 0}
            className={`${FRAC_BTN} bg-blue-100 hover:bg-blue-50 border-blue-200 text-blue-900`}
          >
            ¼
          </button>
          <button
            type="button"
            onClick={() => onAddChip(Math.floor(bankroll / 2))}
            disabled={currentBet >= bankroll || bankroll <= 0}
            className={`${FRAC_BTN} bg-blue-50 hover:bg-white border-blue-100 text-blue-900`}
          >
            ½
          </button>
          <button
            type="button"
            onClick={() => onAddChip(bankroll)}
            disabled={currentBet >= bankroll || bankroll <= 0}
            className={`${FRAC_BTN} bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900`}
          >
            All In
          </button>
        </>
      )}
    </div>
  )
}

export function GameBoardHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-zinc-500 text-center px-2 max-w-md">{children}</p>
}

