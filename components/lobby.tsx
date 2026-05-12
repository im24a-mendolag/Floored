'use client'

import { useRouter } from 'next/navigation'
import type { GameName } from '@/store/types'

interface GameEntry {
  name: GameName
  label: string
  sub: string
  available: boolean
  gradient: string
  accent: string
}

const GAMES: GameEntry[] = [
  {
    name: 'blackjack',
    label: 'Blackjack',
    sub: 'Beat the dealer',
    available: true,
    gradient: 'from-emerald-950 to-emerald-900',
    accent: 'border-emerald-700 hover:border-emerald-500',
  },
  {
    name: 'crash',
    label: 'Crash',
    sub: 'Cash out before it crashes',
    available: true,
    gradient: 'from-violet-950 to-indigo-950',
    accent: 'border-violet-700 hover:border-violet-500',
  },
  {
    name: 'plinko',
    label: 'Plinko',
    sub: 'Drop the puck',
    available: true,
    gradient: 'from-sky-950 to-blue-950',
    accent: 'border-sky-700 hover:border-sky-500',
  },
  {
    name: 'hilo',
    label: 'Hi-Lo',
    sub: 'Pick your safe zone',
    available: true,
    gradient: 'from-teal-950 to-cyan-950',
    accent: 'border-teal-700 hover:border-teal-500',
  },
  {
    name: 'wheel',
    label: 'Wheel',
    sub: '2× to 5× — pick your color',
    available: true,
    gradient: 'from-rose-950 to-red-950',
    accent: 'border-rose-700 hover:border-rose-500',
  },
  {
    name: 'run-dice',
    label: 'Run Dice',
    sub: 'Roll to survive',
    available: true,
    gradient: 'from-orange-950 to-amber-950',
    accent: 'border-orange-700 hover:border-orange-500',
  },
  {
    name: 'mines',
    label: 'Mines',
    sub: 'Find the safe tiles',
    available: true,
    gradient: 'from-lime-950 to-green-950',
    accent: 'border-lime-700 hover:border-lime-500',
  },
  {
    name: 'chicken-road',
    label: 'Chicken Road',
    sub: 'Cross without getting hit',
    available: true,
    gradient: 'from-yellow-950 to-amber-950',
    accent: 'border-yellow-700 hover:border-yellow-500',
  },
  {
    name: 'slots',
    label: 'Slots',
    sub: '3 reels · jackpot meter',
    available: true,
    gradient: 'from-violet-950 to-purple-950',
    accent: 'border-violet-700 hover:border-violet-400',
  },
]

interface Props {
  mode: 'survival' | 'freeplay'
}

export function Lobby({ mode }: Props) {
  const router = useRouter()

  function handlePick(game: GameName) {
    router.push(`/${mode}/${game}`)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {GAMES.map((g, i) => {
        // last item spans full width on mobile if it would be orphaned (odd total, 2-col)
        const isOrphan = GAMES.length % 2 !== 0 && i === GAMES.length - 1

        return (
          <button
            key={g.name}
            onClick={() => g.available && handlePick(g.name)}
            className={[
              'relative overflow-hidden rounded-2xl border transition-all duration-200 text-left',
              isOrphan ? 'col-span-2 sm:col-span-1' : 'col-span-1',
              g.gradient ? `bg-gradient-to-br ${g.gradient}` : '',
              g.accent,
              g.available
                ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group'
                : 'opacity-40 cursor-not-allowed',
            ].join(' ')}
          >
            {/* Felt texture overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }}
            />

            {/* Card content */}
            <div className={`relative p-5 flex flex-col justify-between ${isOrphan ? 'h-24 sm:h-32' : 'h-32'}`}>
              <div>
                <p className="text-white font-black text-xl sm:text-2xl leading-tight tracking-tight group-hover:scale-105 origin-left transition-transform duration-200">
                  {g.label}
                </p>
                <p className="text-white/40 text-xs mt-1">{g.sub}</p>
              </div>

              {g.available && (
                <div className="flex items-center gap-1 text-white/30 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Play now
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
