'use client'

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type MatchHistoryTone = 'win' | 'push' | 'loss' | 'partial' | 'neutral'

export interface MatchHistoryEntry {
  id: string
  at: Date
  title: string
  subtitle: string
  tone: MatchHistoryTone
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

/** ~17rem cap, matches previous panel */
const PANEL_W = 272
const GAP = 8

interface GameFieldWithHistoryProps {
  entries: MatchHistoryEntry[]
  gameLabel: string
  emptyHint?: string
  /** Playing field shell (e.g. GAME_BOARD_ARENA) — layout size unchanged when history opens */
  className?: string
  /** Inner board wrapper: padding, flex-col, centering, etc. */
  boardClassName?: string
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
  children,
}: GameFieldWithHistoryProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const hasPlays = entries.length > 0
  const latest = entries[0]

  const fieldRef = useRef<HTMLDivElement>(null)
  const [panelBox, setPanelBox] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  const updatePanelPosition = useCallback(() => {
    if (!open || !hasPlays) return
    const el = fieldRef.current
    if (!el || typeof window === 'undefined') return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const panelWidth = Math.min(PANEL_W, vw * 0.92, vw - 16)
    let left = r.right + GAP
    if (left + panelWidth > vw - 8) {
      left = Math.max(8, vw - panelWidth - 8)
    }
    const top = Math.max(8, r.top)
    const maxH = vh - top - 8
    const height = Math.min(Math.max(r.height, 120), maxH)
    setPanelBox({ top, left, width: panelWidth, height })
  }, [open, hasPlays])

  useLayoutEffect(() => {
    if (!open || !hasPlays) {
      setPanelBox(null)
      return
    }
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, hasPlays, updatePanelPosition, entries.length])

  const historyPortal =
    open && hasPlays && panelBox && typeof document !== 'undefined' ? (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[85] cursor-default border-0 bg-black/15 p-0"
          onClick={close}
          aria-label="Close history"
        />
        <aside
          className={cn(
            'fixed z-[90] flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl',
          )}
          style={{
            top: panelBox.top,
            left: panelBox.left,
            width: panelBox.width,
            height: panelBox.height,
            maxHeight: panelBox.height,
          }}
          aria-label={`${gameLabel} match history`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Full history</span>
            <button
              type="button"
              onClick={close}
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-2">
            {entries.map((e) => (
              <div key={e.id} className={cn('rounded-lg border px-2.5 py-2 text-left', toneBorder(e.tone))}>
                <p className="text-[10px] text-zinc-500 tabular-nums">{formatTime(e.at)}</p>
                <p className={cn('text-sm font-bold', toneTitle(e.tone))}>{e.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500">{e.subtitle}</p>
              </div>
            ))}
          </div>
        </aside>
      </>
    ) : null

  return (
    <>
      <div ref={fieldRef} className={cn('relative min-h-0 w-full flex-1 overflow-hidden', className)}>
        <div className={cn('relative min-h-0 min-w-0 h-full w-full overflow-hidden', boardClassName)}>
          {children}

          {hasPlays && latest ? (
            <div className="pointer-events-auto absolute right-2 top-2 z-30 flex max-w-[min(13rem,46vw)] flex-col items-end">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className={cn(
                  'rounded-xl border border-zinc-700/90 bg-zinc-950/95 px-3 py-2 text-left shadow-lg backdrop-blur-sm',
                  'hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500',
                )}
              >
                <p className="text-[9px] uppercase tracking-wider text-zinc-600">{gameLabel} · last</p>
                <p className={cn('truncate text-sm font-semibold leading-tight', toneTitle(latest.tone))}>
                  {latest.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">{latest.subtitle}</p>
                <p className="mt-1 text-[10px] text-zinc-600">{open ? 'Hide full history' : 'Open full history'}</p>
              </button>
            </div>
          ) : (
            <div className="pointer-events-none absolute right-2 top-2 z-20 max-w-[min(11rem,44vw)] text-right text-[10px] leading-snug text-zinc-600">
              {emptyHint}
            </div>
          )}
        </div>
      </div>
      {historyPortal ? createPortal(historyPortal, document.body) : null}
    </>
  )
}
