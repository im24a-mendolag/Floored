import type { GameResolveFn, GameResolvePayload, ResolvedGamePayload } from '@/hooks/use-game-bankroll'

/** Call onResolve and merge returned adjusted payout/multiplier for match history UI. */
export function resolveGame<T extends GameResolvePayload>(
  onResolve: GameResolveFn<T>,
  payload: T,
): T & ResolvedGamePayload {
  const result = onResolve(payload)
  if (!result) return payload as T & ResolvedGamePayload
  return { ...payload, ...result } as T & ResolvedGamePayload
}
