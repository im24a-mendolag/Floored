'use client'

import { useSurvivalStore } from '@/store/survival-store'
import type { FloorMission } from '@/store/types'
import { formatChips } from '@/utils/format'

function missionLabel(m: FloorMission): string {
  switch (m.type) {
    case 'win_streak':
      return `Win ${m.target} in a row`
    case 'play_game': {
      const game = m.game?.split('-').join(' ') ?? 'a game'
      const min = m.minBet != null ? ` at ${formatChips(m.minBet)}+` : ''
      return `Play ${game}${min}`
    }
    case 'min_multiplier':
      return `Win with ${m.target}×+ multiplier`
    case 'games_played':
      return `Play ${m.target} games this floor`
    case 'flawless':
      return 'No losses this floor'
    case 'win_count':
      return `Win ${m.target} rounds this floor`
    case 'big_win':
      return `Net ${formatChips(m.target)}+ in one round`
    default:
      return m.type
  }
}

interface MissionPanelProps {
  compact?: boolean
}

export function MissionPanel({ compact = false }: MissionPanelProps) {
  const missions = useSurvivalStore((s) => s.missions)

  const activeMissions = missions.filter((m) => !m.completed && !m.failed)
  const settledMissions = missions.filter((m) => m.completed || m.failed)

  function renderMission(m: FloorMission) {
    const pct = m.target > 0 ? Math.min(100, (m.progress / m.target) * 100) : 0
    const failed = m.failed === true
    return (
      <li
        key={m.id}
        className={`rounded-lg border px-2.5 py-2 ${
          m.completed
            ? 'border-emerald-800/50 bg-emerald-950/20'
            : failed
              ? 'border-red-900/50 bg-red-950/20'
              : 'border-zinc-800 bg-zinc-950/40'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`leading-snug ${compact ? 'text-[11px]' : 'text-xs'} ${
              m.completed
                ? 'text-emerald-400 line-through'
                : failed
                  ? 'text-red-400 line-through'
                  : 'text-zinc-300'
            }`}
          >
            {missionLabel(m)}
            {failed && !m.completed ? ' — failed' : ''}
          </span>
          <span className={`shrink-0 font-semibold text-amber-400 tabular-nums ${compact ? 'text-[10px]' : 'text-xs'}`}>
            ✦ {m.rewardSparks}
          </span>
        </div>
        {!m.completed && !failed && (
          <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-amber-500/70 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </li>
    )
  }

  if (missions.length === 0) {
    return (
      <div className={`h-full rounded-xl border border-zinc-800 bg-zinc-900/60 ${compact ? 'p-2' : 'p-4'}`}>
        <p className="text-xs text-zinc-500">No missions this floor.</p>
      </div>
    )
  }

  return (
    <div className={`h-full rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col gap-2 ${compact ? 'p-2' : 'p-4'}`}>
      <div className="shrink-0">
        <p className={`font-semibold uppercase tracking-wider text-zinc-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Missions
          <span className="text-zinc-600 font-normal normal-case tracking-normal">
            {' '}({missions.length}{activeMissions.length > 0 && activeMissions.length < missions.length ? ` · ${activeMissions.length} active` : ''})
          </span>
        </p>
        {!compact && (
          <p className="text-[10px] text-zinc-600 leading-snug mt-0.5">
            Play-game missions use this floor&apos;s lobby only.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-0.5 min-h-0">
        {activeMissions.length > 0 && (
          <ul className="flex flex-col gap-2 shrink-0">
            {activeMissions.length < missions.length && (
              <li className="list-none">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-500/80 px-0.5">
                  Active
                </p>
              </li>
            )}
            {activeMissions.map((m) => renderMission(m))}
          </ul>
        )}

        {settledMissions.length > 0 && (
          <ul className="flex flex-col gap-2 shrink-0">
            {activeMissions.length > 0 && (
              <li className="list-none">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 px-0.5 pt-1">
                  Done
                </p>
              </li>
            )}
            {settledMissions.map((m) => renderMission(m))}
          </ul>
        )}
      </div>
    </div>
  )
}
