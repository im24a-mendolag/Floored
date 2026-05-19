import type { MatchHistoryEntry, MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'

export interface GameRoundAmounts {
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | 'push'
}

export interface GamePendingResult {
  tone: 'win' | 'loss'
  betSummary: string
  resultSummary: string
  profitLabel: string
  multiplierHint?: string
  entry: MatchHistoryEntry
}

/** Net profit/loss for settled dock display. */
export function formatNetProfitDisplay(
  payout: number,
  betAmount: number,
  outcome: GameRoundAmounts['outcome'],
): string {
  if (outcome === 'push') return '$0'
  const net = payout - betAmount
  if (net > 0) return `+${formatChips(net)}`
  if (net < 0) return `−${formatChips(-net)}`
  return '$0'
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

export function formatSettledMultiplierHint(
  gameMultiplier?: number,
  payoutBoostMult?: number,
): string | undefined {
  const parts: string[] = []
  if (gameMultiplier != null && gameMultiplier > 0) {
    parts.push(formatMultiplier(gameMultiplier))
  }
  if (payoutBoostMult != null && payoutBoostMult > 1) {
    parts.push(`${formatMultiplier(payoutBoostMult)} boost`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function buildPendingResult(
  amounts: GameRoundAmounts,
  detail: { bet: string; result: string },
  options?: {
    historySubtitle?: string
    gameMultiplier?: number
    payoutBoostMult?: number
  },
): GamePendingResult {
  const net = amounts.payout - amounts.betAmount
  const tone: 'win' | 'loss' = net >= 0 ? 'win' : 'loss'
  const historyTone: MatchHistoryTone =
    amounts.outcome === 'win' || amounts.outcome === 'push'
      ? 'win'
      : amounts.outcome === 'loss'
        ? 'loss'
        : amounts.payout > amounts.betAmount
          ? 'win'
          : 'loss'
  const title = formatHistoryNetTitle(amounts.payout, amounts.betAmount, amounts.outcome)
  const profitLabel = formatNetProfitDisplay(amounts.payout, amounts.betAmount, amounts.outcome)
  const multiplierHint = formatSettledMultiplierHint(options?.gameMultiplier, options?.payoutBoostMult)
  const subtitle =
    options?.historySubtitle ?? `${detail.bet} → ${detail.result}`

  return {
    tone,
    betSummary: detail.bet,
    resultSummary: detail.result,
    profitLabel,
    multiplierHint,
    entry: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      at: new Date(),
      title,
      subtitle,
      tone: historyTone,
    },
  }
}
