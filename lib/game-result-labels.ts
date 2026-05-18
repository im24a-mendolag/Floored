import type { MatchHistoryEntry, MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'

export interface GameRoundAmounts {
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | 'push'
}

/** Settled dock: total chips returned to the player (not net profit/loss). */
export function formatSettledWinningsDisplay(payout: number) {
  if (payout > 0) return formatChips(payout)
  return formatChips(0)
}

/** Match history title: net profit/loss. */
export function formatHistoryNetTitle(payout: number, betAmount: number, outcome: GameRoundAmounts['outcome']) {
  if (outcome === 'push') return '$0'
  const net = payout - betAmount
  if (outcome === 'win' && net === 0 && payout > 0) return formatChips(payout)
  if (net > 0) return `+${formatChips(net)}`
  if (net < 0) return `−${formatChips(-net)}`
  return '$0'
}

export function buildPendingResult(
  amounts: GameRoundAmounts,
  subtitle: string,
  options?: { winLabel?: string; lossLabel?: string },
) {
  const tone: MatchHistoryTone =
    amounts.outcome === 'win' || amounts.outcome === 'push'
      ? 'win'
      : amounts.outcome === 'loss'
        ? 'loss'
        : amounts.payout > amounts.betAmount
          ? 'win'
          : 'loss'
  const title = formatHistoryNetTitle(amounts.payout, amounts.betAmount, amounts.outcome)
  const label = formatSettledWinningsDisplay(amounts.payout)
  const outcomeLabel =
    amounts.payout > 0
      ? (options?.winLabel ?? 'Total winnings')
      : amounts.outcome === 'push'
        ? 'Push'
        : (options?.lossLabel ?? 'No winnings')

  return {
    tone,
    label,
    outcomeLabel,
    entry: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      at: new Date(),
      title,
      subtitle,
      tone,
    } satisfies MatchHistoryEntry,
  }
}
