'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFreeplayStore } from '@/store/freeplay-store'
import { formatChips } from '@/utils/format'

export function Navbar() {
  const pathname = usePathname()
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)

  const inFreeplay = pathname?.startsWith('/freeplay')

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* ── Left: brand + nav links ── */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-black tracking-[0.2em] uppercase text-white hover:text-white/80 transition-colors">
              FLOORED
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {/* Survival — disabled until ready */}
              <span
                title="Coming soon"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/20 cursor-not-allowed select-none"
              >
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

          {/* ── Right: bankroll chip ── */}
          {inFreeplay && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
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

        </div>

        {/* Mobile nav strip */}
        <div className="sm:hidden flex gap-1 pb-2">
          <span className="flex-1 text-center py-1.5 rounded-lg text-sm font-medium text-white/20 cursor-not-allowed select-none">
            Survival
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
