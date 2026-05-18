'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSettingsStore } from '@/store/settings-store'
import { formatChips } from '@/utils/format'

export function Navbar() {
  const pathname = usePathname()
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const { autoReBet, setAutoReBet } = useSettingsStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const inFreeplay = pathname?.startsWith('/freeplay')

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

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Left: brand + nav links */}
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/"
              className="text-lg font-black tracking-[0.2em] uppercase text-white hover:text-white/80 transition-colors shrink-0"
            >
              FLOORED
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              <span
                title="In development"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/20 cursor-not-allowed select-none flex items-center gap-1.5"
              >
                <span aria-hidden>🚧</span>
                Survival
              </span>

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

          {/* Right: bankroll + account */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
          <span className="flex-1 text-center py-1.5 rounded-lg text-sm font-medium text-white/20 cursor-not-allowed select-none">
            🚧 Survival
          </span>
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
  )
}
