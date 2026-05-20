import type { FloorMission, GameName } from '@/store/types'
import type { MissionType } from './missions'

export interface MissionGameEvent {
  game: GameName
  floor: number
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | 'push'
  multiplier?: number
  bankroll: number
  floorStartBankroll: number
  streak: number
  gamesPlayedThisFloor: number
  /** Plinko multi-ball: at least one ball in the drop lost (streak / flawless). */
  subRoundLoss?: boolean
}

export interface MissionFloorCompleteEvent {
  bankroll: number
  floorStartBankroll: number
}

function clampProgress(progress: number, target: number): number {
  return Math.min(target, Math.max(0, progress))
}

function markComplete(m: FloorMission): FloorMission {
  if (m.completed) return m
  return { ...m, progress: m.target, completed: true }
}

export function evaluateMissionOnGame(m: FloorMission, event: MissionGameEvent): FloorMission {
  if (m.completed || m.failed) return m
  const type = m.type as MissionType
  const minBet = m.minBet ?? 0

  switch (type) {
    case 'win_streak': {
      // Ignore games below min bet so tiny bets can't farm or break streaks
      if (event.betAmount < minBet) return m
      if (event.subRoundLoss || event.outcome === 'loss') return { ...m, progress: 0 }
      if (event.outcome !== 'win') return m
      const progress = clampProgress(m.progress + 1, m.target)
      const next = { ...m, progress }
      return progress >= m.target ? markComplete(next) : next
    }
    case 'play_game': {
      if (m.game && event.game !== m.game) return m
      if (event.betAmount < minBet) return m
      const progress = clampProgress(m.progress + 1, m.target)
      const next = { ...m, progress }
      return progress >= m.target ? markComplete(next) : next
    }
    case 'min_multiplier': {
      if (event.outcome !== 'win') return m
      if (event.betAmount < minBet) return m
      const mult = event.multiplier ?? (event.payout > event.betAmount ? event.payout / event.betAmount : 0)
      if (mult < m.target) return m
      return markComplete({ ...m, progress: m.target })
    }
    case 'games_played': {
      if (event.betAmount < minBet) return m
      const progress = clampProgress(m.progress + 1, m.target)
      const next = { ...m, progress }
      return progress >= m.target ? markComplete(next) : next
    }
    case 'flawless': {
      // Any qualifying loss fails flawless; tiny bets don't count as losses
      if (event.betAmount < minBet) return m
      if (event.subRoundLoss || event.outcome === 'loss') {
        return { ...m, failed: true, progress: 0 }
      }
      return m
    }
    case 'win_count': {
      if (event.outcome !== 'win') return m
      if (event.betAmount < minBet) return m
      const progress = clampProgress(m.progress + 1, m.target)
      const next = { ...m, progress }
      return progress >= m.target ? markComplete(next) : next
    }
    case 'big_win': {
      if (event.outcome !== 'win') return m
      if (event.betAmount < minBet) return m
      const net = event.payout - event.betAmount
      if (net < m.target) return m
      return markComplete({ ...m, progress: m.target })
    }
    default:
      return m
  }
}

export function evaluateMissionOnFloorComplete(m: FloorMission): FloorMission {
  if (m.completed || m.failed || (m.type as MissionType) !== 'flawless') return m
  return markComplete({ ...m, progress: m.target })
}

export function evaluateMissionsOnGame(
  missions: FloorMission[],
  event: MissionGameEvent,
): FloorMission[] {
  return missions.map((m) => evaluateMissionOnGame(m, event))
}

export function evaluateMissionsOnFloorComplete(
  missions: FloorMission[],
  event: MissionFloorCompleteEvent,
): FloorMission[] {
  void event
  return missions.map((m) => evaluateMissionOnFloorComplete(m))
}
