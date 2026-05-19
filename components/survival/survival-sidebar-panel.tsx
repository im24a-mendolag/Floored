'use client'

import type { ReactNode } from 'react'

export const SURVIVAL_SIDEBAR_PANEL_CLASS =
  'rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 flex flex-col gap-1.5 min-h-0'

export function SurvivalSidebarPanel({
  title,
  count,
  compact = false,
  empty,
  emptyLabel,
  footer,
  children,
}: {
  title: string
  count?: number
  compact?: boolean
  empty?: boolean
  emptyLabel?: string
  footer?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className={`${SURVIVAL_SIDEBAR_PANEL_CLASS} ${compact ? 'h-full' : 'shrink'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
        {title}
        {count != null && (
          <span className="text-zinc-600 font-normal normal-case tracking-normal"> ({count})</span>
        )}
      </p>

      {empty ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 text-center px-1">
          <span className="text-[10px] text-zinc-600">{emptyLabel ?? 'Nothing here yet'}</span>
          {footer}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 flex flex-col gap-1 pr-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

export function SurvivalSidebarRow({
  name,
  scope,
}: {
  name: string
  scope?: string | null
}) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <p className="text-[11px] text-zinc-300 leading-snug">{name}</p>
      {scope && (
        <p className="text-[9px] text-zinc-600 uppercase tracking-wide leading-none">{scope}</p>
      )}
    </div>
  )
}
