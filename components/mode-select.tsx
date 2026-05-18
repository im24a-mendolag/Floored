'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DifficultyDialog } from '@/components/difficulty-dialog'
import { useSurvivalStore } from '@/store/survival-store'

const FELT = {
  backgroundImage:
    'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
  backgroundSize: '6px 6px',
}

const PLAY_ICON = (
  <svg viewBox="0 0 10 10" className="w-3 h-3 fill-white translate-x-px" aria-hidden>
    <polygon points="2,1 9,5 2,9" />
  </svg>
)

export function ModeSelect() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const [difficultyOpen, setDifficultyOpen] = useState(false)

  function handleSurvivalClick() {
    if (runActive) {
      router.push('/survival')
    } else {
      setDifficultyOpen(true)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {/* ── Survival ── */}
        <button
          type="button"
          onClick={handleSurvivalClick}
          className="relative overflow-hidden rounded-2xl border border-amber-900 hover:border-amber-600 bg-gradient-to-br from-amber-950 to-red-950 cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group transition-all duration-200 text-left"
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
          <div className="relative p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-3xl tracking-tight group-hover:scale-[1.04] origin-left transition-transform duration-200">
                Survival
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                Floor quotas, rising minimum bets. Run ends when you go broke.
              </p>
            </div>

            <ul className="space-y-1.5">
              {[
                '1,000 starting chips',
                'Floor min bet rises each level',
                'Earn Sparks for upgrades',
                'Choose your difficulty',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                {PLAY_ICON}
              </div>
              <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                {runActive ? 'Continue run' : 'Play now'}
              </span>
            </div>
          </div>
        </button>

        {/* ── Freeplay ── */}
        <Link
          href="/freeplay"
          className="relative overflow-hidden rounded-2xl border border-blue-900 hover:border-blue-600 bg-gradient-to-br from-slate-900 to-blue-950 cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group transition-all duration-200 text-left"
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
          <div className="relative p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-3xl tracking-tight group-hover:scale-[1.04] origin-left transition-transform duration-200">
                Freeplay
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                All games, no floors, no pressure. 10,000 chips to start.
              </p>
            </div>

            <ul className="space-y-1.5">
              {[
                'No economy, no stakes',
                'Practice any game',
                'Infinite reset',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                {PLAY_ICON}
              </div>
              <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                Play now
              </span>
            </div>
          </div>
        </Link>
      </div>

      <DifficultyDialog open={difficultyOpen} onClose={() => setDifficultyOpen(false)} />
    </>
  )
}
