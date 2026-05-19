import type { FloorMission } from '@/store/types'

/** Missions can be rerolled only before any progress or completion. */
export function canRerollMissions(missions: FloorMission[]): boolean {
  return missions.every((m) => !m.completed && !m.failed && m.progress === 0)
}
