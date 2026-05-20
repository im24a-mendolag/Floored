import type { FloorMission } from '@/store/types'
import { pickMissionRerollForSlot } from './missions'

/** A single mission can be rerolled only before any progress or completion. */
export function canRerollMission(m: FloorMission): boolean {
  return !m.completed && !m.failed && m.progress === 0
}

/** Missions can be rerolled only before any progress or completion. */
export function canRerollMissions(missions: FloorMission[]): boolean {
  return missions.every((m) => canRerollMission(m))
}

/** Lobby ticket reroll: once per slot, only if a new mission remains in the floor pool. */
export function canRerollMissionWithTicket(
  index: number,
  missions: FloorMission[],
  offeredKeys: string[],
  ticketRerolledSlots: number[],
  input: {
    runSeed: string
    floor: number
    difficulty: import('@/store/types').Difficulty
    floorGames: import('@/store/types').GameName[]
    floorMinBet: number
    rollSeq: number
  },
): boolean {
  if (index < 0 || index >= missions.length) return false
  if (ticketRerolledSlots.includes(index)) return false
  const m = missions[index]
  if (!m || !canRerollMission(m)) return false
  return (
    pickMissionRerollForSlot({
      ...input,
      slotIndex: index,
      offeredKeys,
    }) != null
  )
}
