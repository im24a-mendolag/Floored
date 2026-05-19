'use client'

interface PerkHintProps {
  children: React.ReactNode
  className?: string
  /** When false, hint is hidden (perk owned but did not proc this bet). */
  active?: boolean
}

/** Banner when a survival perk proc’d for the current bet. */
export function PerkHint({ children, className = '', active = true }: PerkHintProps) {
  if (!active) return null

  return (
    <p
      className={`text-center text-[11px] font-semibold text-emerald-300 bg-emerald-950/55 border border-emerald-500/55 rounded-lg px-2 py-1 shadow-[0_0_12px_rgba(16,185,129,0.25)] animate-pulse ${className}`}
    >
      ✦ Perk active — {children}
    </p>
  )
}
