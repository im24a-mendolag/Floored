import type { FloorMission } from '@/store/types'

/** A single mission can be rerolled only before any progress or completion. */
export function canRerollMission(m: FloorMission): boolean {
  return !m.completed && !m.failed && m.progress === 0
}

/** Missions can be rerolled only before any progress or completion. */
export function canRerollMissions(missions: FloorMission[]): boolean {
  return missions.every((m) => canRerollMission(m))
}
