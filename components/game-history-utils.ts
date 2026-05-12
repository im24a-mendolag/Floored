import type { Dispatch, SetStateAction } from 'react'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { MatchHistoryEntry, MatchHistoryTone } from '@/components/game-match-history'

/** Append one settled play (newest first), same copy rules as Plinko. */
export function appendPlay(
  setHistory: Dispatch<SetStateAction<MatchHistoryEntry[]>>,
  opts: { bet: number; payout: number; mult: number; outcome: 'win' | 'loss' | 'push'; titlePrefix?: string },
) {
  const { bet, payout, mult, outcome, titlePrefix } = opts
  const net = bet - payout
  let tone: MatchHistoryTone
  let title: string
  if (outcome === 'win') {
    tone = 'win'
    title = `+${formatChips(payout)}`
  } else if (outcome === 'push') {
    tone = 'push'
    title = `Push ${formatChips(payout)}`
  } else if (payout > 0) {
    tone = 'partial'
    title = `+${formatChips(payout)} · net −${formatChips(net)}`
  } else {
    tone = 'loss'
    title = `−${formatChips(bet)}`
  }
  if (titlePrefix) title = `${titlePrefix} — ${title}`
  const subtitle = `${formatChips(bet)} bet · ${formatMultiplier(mult)}`
  setHistory((h) =>
    [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, at: new Date(), title, subtitle, tone }, ...h].slice(
      0,
      80,
    ),
  )
}
