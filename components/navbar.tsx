'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSettingsStore } from '@/store/settings-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import {
  useFloorTimer,
  useFloorTimeRemainingMs,
  formatFloorTime,
} from '@/hooks/use-floor-timer'
import { FloorPauseModal } from '@/components/survival/floor-pause-modal'

const HUD_PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

export function Navbar() {
  const pathname = usePathname()
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const { autoReBet, setAutoReBet } = useSettingsStore()
  const runActive = useSurvivalStore((s) => s.runActive)
  const floorTimerPaused = useSurvivalStore((s) => s.floorTimerPaused)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const quotaMet = useSurvivalStore((s) => s.quotaMet)
  const toggleFloorTimerPause = useSurvivalStore((s) => s.toggleFloorTimerPause)
  const finishQuotaEarly = useSurvivalStore((s) => s.finishQuotaEarly)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useFloorTimer()
  const floorTimeRemainingMs = useFloorTimeRemainingMs()

  const inFreeplay = pathname?.startsWith('/freeplay')
  const inSurvival = pathname?.startsWith('/survival')

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const survivalDesktop = runActive ? (
    <Link
      href="/survival"
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        inSurvival
          ? 'bg-amber-900/40 text-amber-300'
          : 'text-white/60 hover:text-white hover:bg-white/8'
      }`}
    >
      Survival
    </Link>
  ) : (
    <Link
      href="/"
      className="px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 transition-colors"
    >
      Survival
    </Link>
  )

  const survivalMobile = runActive ? (
    <Link
      href="/survival"
      className={`flex-1 text-center py-1.5 rounded-lg text-sm font-medium transition-colors ${
        inSurvival ? 'bg-amber-900/40 text-amber-300' : 'text-white/50 hover:text-white/80'
      }`}
    >
      Survival
    </Link>
  ) : (
    <Link
      href="/"
      className="flex-1 text-center py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
    >
      Survival
    </Link>
  )

  const showFinishQuota =
    runActive && quotaMet && !floorComplete && !runDefeated

  return (
    <>
      <FloorPauseModal />
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="relative flex items-center justify-between h-16">

            {/* Left: brand + nav links */}
            <div className="flex items-center gap-4 min-w-0 z-10">
              <Link
                href="/"
                className="text-lg font-black tracking-[0.2em] uppercase text-white hover:text-white/80 transition-colors shrink-0"
              >
                FLOORED
              </Link>

              <div className="hidden sm:flex items-center gap-1">
                {survivalDesktop}

                <Link
                  href="/freeplay"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    inFreeplay
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/8'
                  }`}
                >
                  Freeplay
                </Link>
              </div>
            </div>

            {/* Center: finish quota (early floor clear) */}
            {showFinishQuota && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <button
                  type="button"
                  onClick={() => finishQuotaEarly()}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wide bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/25 whitespace-nowrap"
                >
                  Finish Quota
                </button>
              </div>
            )}

            {/* Right: timer + account */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-10">
              {runActive && (
                <div className="flex items-center gap-1.5">
                  {!floorComplete && !runDefeated && (
                    <>
                      <div className={`${HUD_PILL} min-w-[3.25rem] text-center`}>
                        {formatFloorTime(floorTimeRemainingMs)}
                      </div>
                      {!floorTimerPaused && (
                        <button
                          type="button"
                          onClick={() => toggleFloorTimerPause()}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                          aria-label="Pause floor timer"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                            <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {inFreeplay && (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-right">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider leading-none mb-0.5">
                      Freeplay
                    </p>
                    <p className="text-white font-bold text-sm leading-none tabular-nums">
                      {formatChips(freeplayBankroll)}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 flex-shrink-0" />
                </div>
              )}


              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Account settings"
                  aria-expanded={menuOpen}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#12121a] py-2 shadow-xl z-50">
                    <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Settings
                    </p>
                    <button
                      type="button"
                      onClick={() => setAutoReBet(!autoReBet)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm text-white/80">Auto re-bet</span>
                      <div
                        className={`relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${autoReBet ? 'bg-emerald-500' : 'bg-white/20'}`}
                      >
                        <div
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${autoReBet ? 'translate-x-[13px]' : 'translate-x-0.5'}`}
                        />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile nav strip */}
          <div className="sm:hidden flex gap-1 pb-2">
            {survivalMobile}
            <Link
              href="/freeplay"
              className={`flex-1 text-center py-1.5 rounded-lg text-sm font-medium transition-colors ${
                inFreeplay ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Freeplay
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}
