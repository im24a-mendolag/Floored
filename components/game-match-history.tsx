'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { hasOutcomeEntry, GameOutcomeColumns, GameLastBetPanel } from '@/components/game-dock-parts'
import { cn } from '@/lib/utils'

export type MatchHistoryTone = 'win' | 'push' | 'loss' | 'partial' | 'neutral'

export interface MatchHistoryEntry {
  id: string
  at: Date
  title: string
  subtitle: string
  tone: MatchHistoryTone
  betSummary?: string
  resultSummary?: string
  profitLabel?: string
  profitTone?: 'win' | 'loss'
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function toneBorder(t: MatchHistoryTone) {
  if (t === 'win') return 'border-green-900/60 bg-green-950/30'
  if (t === 'push') return 'border-zinc-700 bg-zinc-900/50'
  if (t === 'partial') return 'border-amber-900/50 bg-amber-950/25'
  if (t === 'loss') return 'border-red-900/50 bg-red-950/20'
  return 'border-zinc-800 bg-zinc-900/40'
}

function toneTitle(t: MatchHistoryTone) {
  if (t === 'win') return 'text-green-400'
  if (t === 'push') return 'text-zinc-200'
  if (t === 'partial') return 'text-amber-300'
  if (t === 'loss') return 'text-red-400'
  return 'text-zinc-300'
}

/** Wider panel for three-column outcome rows */

function HistoryEntryCard({ entry }: { entry: MatchHistoryEntry }) {
  if (hasOutcomeEntry(entry)) {
    return (
      <div className={cn('rounded-lg border px-3 py-2.5 text-left', toneBorder(entry.tone))}>
        <p className="text-[10px] text-zinc-500 tabular-nums mb-2">{formatTime(entry.at)}</p>
        <GameOutcomeColumns
          betSummary={entry.betSummary!}
          resultSummary={entry.resultSummary!}
          profitLabel={entry.profitLabel!}
          profitTone={entry.profitTone ?? 'loss'}
          size="history"
        />
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border px-2.5 py-2 text-left', toneBorder(entry.tone))}>
      <p className="text-[10px] text-zinc-500 tabular-nums">{formatTime(entry.at)}</p>
      <p className={cn('text-base font-black', toneTitle(entry.tone))}>{entry.title}</p>
      <p className="mt-0.5 text-xs leading-snug text-zinc-500">{entry.subtitle}</p>
    </div>
  )
}

interface GameFieldWithHistoryProps {
  entries: MatchHistoryEntry[]
  gameLabel: string
  emptyHint?: string
  className?: string
  boardClassName?: string
  showLastBet?: boolean
  children: ReactNode
}

/**
 * Last play capsule on the field; full history opens in a portaled panel fixed to the right of
 * the measured board rect so the playing field layout is never affected.
 */
export function GameFieldWithHistory({
  entries,
  gameLabel,
  emptyHint = 'No plays yet.',
  className,
  boardClassName,
  showLastBet = false,
  children,
}: GameFieldWithHistoryProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const hasPlays = entries.length > 0
  const latest = entries[0]
  const showOutcomeLastBet = showLastBet && latest && hasOutcomeEntry(latest)

  return (
    <div className={cn('relative min-h-0 w-full flex-1 overflow-hidden', className)}>
      <div className={cn('relative min-h-0 min-w-0 h-full w-full overflow-hidden', boardClassName)}>
        {children}

        {showOutcomeLastBet ? (
          <GameLastBetPanel
            betSummary={latest.betSummary!}
            resultSummary={latest.resultSummary!}
            profitLabel={latest.profitLabel!}
            profitTone={latest.profitTone ?? 'loss'}
            historyOpen={open}
            onToggleHistory={toggle}
          />
        ) : (
          <div className="pointer-events-auto absolute right-2 top-2 z-30">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className={cn(
                'rounded-xl border border-zinc-700/90 bg-zinc-950/95 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 shadow-lg backdrop-blur-sm',
                'hover:bg-zinc-900 hover:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500',
              )}
            >
              History
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-[85] cursor-default border-0 bg-black/15 p-0"
            onClick={close}
            aria-label="Close history"
          />
          <aside
            className="absolute inset-y-0 right-0 z-[90] flex w-[min(17rem,80%)] flex-col overflow-hidden border-l border-zinc-700 bg-zinc-950 shadow-2xl"
            aria-label={`${gameLabel} match history`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Match history</span>
              <button
                type="button"
                onClick={close}
                className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-2">
              {hasPlays ? entries.map((e) => (
                <HistoryEntryCard key={e.id} entry={e} />
              )) : (
                <p className="px-1 pt-2 text-xs text-zinc-600">{emptyHint}</p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
