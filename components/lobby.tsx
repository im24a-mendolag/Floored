'use client'

import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import type { GameName } from '@/store/types'

interface GameEntry {
  name: GameName
  label: string
  sub: string
  symbol: string
  /** Shown on /freeplay — game list */
  availableFreeplay: boolean
  /** Shown on /survival lobby */
  availableSurvival: boolean
  gradient: string
  accent: string
}

const GAMES: GameEntry[] = [
  {
    // pos 1 — Crimson
    name: 'blackjack',
    label: 'Blackjack',
    sub: 'Beat the dealer',
    symbol: '♠',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-red-950 to-red-900',
    accent: 'border-red-600 hover:border-red-500',
  },
  {
    // pos 2 — Teal
    name: 'crash',
    label: 'Crash',
    sub: 'Cash out before the crash',
    symbol: '🚀',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-teal-950 to-teal-900',
    accent: 'border-teal-600 hover:border-teal-500',
  },
  {
    // pos 3 — Amber
    name: 'plinko',
    label: 'Plinko',
    sub: 'Drop balls down the board',
    symbol: '⚪',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-amber-950 to-amber-900',
    accent: 'border-amber-600 hover:border-amber-500',
  },
  {
    // pos 4 — Indigo
    name: 'over-under',
    label: 'Over-Under',
    sub: 'Stay inside your safe zone',
    symbol: '⇅',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-indigo-950 to-indigo-900',
    accent: 'border-indigo-600 hover:border-indigo-500',
  },
  {
    // pos 5 — Lime
    name: 'wheel',
    label: 'Fortune Wheel',
    sub: 'Pick a color and spin',
    symbol: '◎',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-lime-950 to-lime-900',
    accent: 'border-lime-600 hover:border-lime-500',
  },
  {
    // pos 6 — Violet
    name: 'run-dice',
    label: 'Run Dice',
    sub: 'Roll dice up the meter',
    symbol: '⚅',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-violet-950 to-violet-900',
    accent: 'border-violet-600 hover:border-violet-500',
  },
  {
    // pos 7 — Coral
    name: 'mines',
    label: 'Mines',
    sub: 'Find the safe tiles',
    symbol: '💣',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-orange-950 to-orange-900',
    accent: 'border-orange-500 hover:border-orange-400',
  },
  {
    // pos 8 — Sky
    name: 'chicken-road',
    label: 'Chicken Road',
    sub: 'Cross the road safely',
    symbol: '🐔',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-sky-950 to-sky-900',
    accent: 'border-sky-600 hover:border-sky-500',
  },
  {
    // pos 9 — Rose
    name: 'slots',
    label: 'Slots',
    sub: 'Spin the reels for payouts',
    symbol: '🎰',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-rose-950 to-rose-900',
    accent: 'border-rose-600 hover:border-rose-500',
  },
  {
    // pos 10 — Emerald
    name: 'roulette',
    label: 'Roulette',
    sub: 'Bet on the wheel and spin',
    symbol: '🎡',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-emerald-950 to-emerald-900',
    accent: 'border-emerald-600 hover:border-emerald-500',
  },
  {
    // pos 11 — Fuchsia
    name: 'dragon-tower',
    label: 'Dragon Tower',
    sub: 'Climb as high as you dare',
    symbol: '🐉',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-fuchsia-950 to-fuchsia-900',
    accent: 'border-fuchsia-700 hover:border-fuchsia-600',
  },
  {
    // pos 12 — Slate
    name: 'chicken-race',
    label: 'Chicken Race',
    sub: 'Pick the winning chicken',
    symbol: '🏁',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-slate-950 to-slate-900',
    accent: 'border-slate-500 hover:border-slate-400',
  },
  {
    // pos 13 — Stone
    name: 'street-cups',
    label: 'Street Cups',
    sub: 'Find the cup with the crown',
    symbol: '👑',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-stone-950 to-stone-800',
    accent: 'border-stone-500 hover:border-stone-400',
  },
  {
    // pos 14 — Cyan
    name: 'case-battles',
    label: 'Case Battles',
    sub: 'Open cases and beat rivals',
    symbol: '🎁',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-cyan-950 to-cyan-900',
    accent: 'border-cyan-600 hover:border-cyan-500',
  },
  {
    // pos 15 — Green
    name: 'poker-1p',
    label: '1 Player Poker',
    sub: 'Build the best poker hand',
    symbol: '🃏',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-green-950 to-green-900',
    accent: 'border-green-600 hover:border-green-500',
  },
  {
    // pos 16 — Purple
    name: 'hilo',
    label: 'HiLo',
    sub: 'Guess higher or lower each card',
    symbol: '↕',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-purple-950 to-purple-900',
    accent: 'border-purple-600 hover:border-purple-500',
  },
  {
    // pos 17 — Pink (between purple HiLo and stone Street Cups; avoids cyan above)
    name: 'keno',
    label: 'Keno',
    sub: 'Match numbers to the draw',
    symbol: '🎱',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-pink-950 to-pink-900',
    accent: 'border-pink-600 hover:border-pink-500',
  },
  {
    // pos 18 — Gold
    name: 'coin-flip',
    label: 'Coin Flip',
    sub: 'Call heads or tails on a flip',
    symbol: '🪙',
    availableFreeplay: true,
    availableSurvival: false,
    gradient: 'from-yellow-950 to-yellow-900',
    accent: 'border-yellow-600 hover:border-yellow-500',
  },
]

interface Props {
  mode: 'survival' | 'freeplay'
}

export function Lobby({ mode }: Props) {
  const router = useRouter()
  const floorGames = useSurvivalStore((s) => s.floorGames)

  function isAvailable(g: GameEntry) {
    if (mode === 'freeplay') return g.availableFreeplay
    return floorGames.includes(g.name)
  }

  function handlePick(game: GameName) {
    router.push(`/${mode}/${game}`)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {GAMES.map((g, i) => {
        const available = isAvailable(g)
        // last item spans full width on mobile if it would be orphaned (odd total, 2-col)
        const isOrphan = GAMES.length % 2 !== 0 && i === GAMES.length - 1

        return (
          <button
            key={g.name}
            onClick={() => available && handlePick(g.name)}
            className={[
              'relative overflow-hidden rounded-2xl border transition-all duration-200 text-left',
              isOrphan ? 'col-span-2 sm:col-span-1' : 'col-span-1',
              g.gradient ? `bg-gradient-to-br ${g.gradient}` : '',
              g.accent,
              available
                ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group'
                : 'cursor-default',
            ].join(' ')}
          >
            {/* Felt texture overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }}
            />

            {/* Card content */}
            <div className={`relative p-5 flex flex-col justify-between ${isOrphan ? 'h-24 sm:h-32' : 'h-32'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none select-none">{g.symbol}</span>
                  <p className="text-white font-black text-xl sm:text-2xl leading-tight tracking-tight group-hover:scale-105 origin-left transition-transform duration-200">
                    {g.label}
                  </p>
                </div>
                <p className="text-white/40 text-xs mt-1">{g.sub}</p>
              </div>

              {available ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                    <svg viewBox="0 0 10 10" className="w-3 h-3 fill-white translate-x-px" aria-hidden>
                      <polygon points="2,1 9,5 2,9" />
                    </svg>
                  </div>
                  <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">Play now</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-white/20 text-xs">
                  <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white/20" aria-hidden>
                    <rect x="2" y="5" width="8" height="6" rx="1" />
                    <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                  Coming soon
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
