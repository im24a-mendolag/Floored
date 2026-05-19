import { createRng, seedFromString } from '@/utils/rng'
import type { GameName } from '@/store/types'

export const LOBBY_REROLL_TICKET_ID = 'reroll_floor_game'

export const LOBBY_REROLL_TICKET = {
  id: LOBBY_REROLL_TICKET_ID,
  name: 'Lobby Reroll Ticket',
  description: 'Reroll one game on this floor’s lobby.',
  baseCost: 8,
} as const

export function getLobbyTicketCount(inventory: { id: string; count: number }[]): number {
  return inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)?.count ?? 0
}

/** Pick a replacement game not already on this floor (excluding the rerolled slot). */
export function pickLobbyReplacement(
  floorGames: GameName[],
  slotIndex: number,
  pool: GameName[],
  rng: () => number,
): GameName | null {
  if (slotIndex < 0 || slotIndex >= floorGames.length) return null
  const others = new Set(floorGames.filter((_, i) => i !== slotIndex))
  const candidates = pool.filter((g) => !others.has(g))
  if (candidates.length === 0) return null
  return candidates[Math.floor(rng() * candidates.length)]!
}

export function rerollLobbySlot(
  floorGames: GameName[],
  slotIndex: number,
  pool: GameName[],
  runSeed: string,
  floor: number,
  rerollCount: number,
): GameName[] | null {
  const rng = createRng(
    seedFromString(`${runSeed}:lobby-reroll:${floor}:${slotIndex}:${rerollCount}`),
  )
  const replacement = pickLobbyReplacement(floorGames, slotIndex, pool, rng)
  if (!replacement) return null
  const next = [...floorGames]
  next[slotIndex] = replacement
  return next
}
