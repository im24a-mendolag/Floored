'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type GameOutcomeTone = 'win' | 'push' | 'loss' | 'neutral'

export interface GameOutcomeToastSnap {
  title: string
  subtitle?: string
  tone: GameOutcomeTone
}

interface GameOutcomeToastProps {
  open: boolean
  title: string
  subtitle?: string
  tone?: GameOutcomeTone
  onDismiss: () => void
  /** Auto-dismiss delay in ms */
  durationMs?: number
}

export function GameOutcomeToast({
  open,
  title,
  subtitle,
  tone = 'neutral',
  onDismiss,
  durationMs = 1000,
}: GameOutcomeToastProps) {
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(id)
  }, [open, durationMs, onDismiss])

  if (!open || typeof document === 'undefined') return null

  const titleCls =
    tone === 'win' ? 'text-emerald-400' :
    tone === 'loss' ? 'text-red-400' :
    tone === 'push' ? 'text-zinc-200' :
    'text-zinc-100'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/20 p-0"
        onClick={onDismiss}
        aria-label="Dismiss result"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="game-outcome-title"
        className={cn(
          'relative z-10 w-full max-w-sm rounded-2xl border border-zinc-600/70 bg-zinc-950/95 px-5 py-4 text-center shadow-2xl',
          'pointer-events-auto',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <p id="game-outcome-title" className={cn('text-lg font-bold tracking-tight', titleCls)}>
          {title}
        </p>
        {subtitle ? <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
    </div>,
    document.body,
  )
}
