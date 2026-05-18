import type { Card, PokerHandRank, PokerState, Rank, Suit } from './types'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export const HAND_PAYOUTS: Record<PokerHandRank, number> = {
  'royal-flush':     800,
  'straight-flush':  50,
  'four-of-a-kind':  25,
  'full-house':       9,
  'flush':            6,
  'straight':         4,
  'three-of-a-kind':  3,
  'two-pair':         2,
  'jacks-or-better':  1,
  'none':             0,
}

export const HAND_LABELS: Record<PokerHandRank, string> = {
  'royal-flush':     'Royal Flush',
  'straight-flush':  'Straight Flush',
  'four-of-a-kind':  'Four of a Kind',
  'full-house':      'Full House',
  'flush':           'Flush',
  'straight':        'Straight',
  'three-of-a-kind': 'Three of a Kind',
  'two-pair':        'Two Pair',
  'jacks-or-better': 'Jacks or Better',
  'none':            'No Hand',
}

function createDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })))
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function rankVal(rank: Rank): number {
  const vals: Record<Rank, number> = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
  }
  return vals[rank]
}

export function getWinningIndices(hand: Card[], rank: PokerHandRank): number[] {
  if (rank === 'none') return []
  if (
    rank === 'royal-flush' || rank === 'straight-flush' ||
    rank === 'flush' || rank === 'straight' || rank === 'full-house'
  ) return [0, 1, 2, 3, 4]

  const byRank: Record<string, number[]> = {}
  hand.forEach((card, i) => {
    ;(byRank[card.rank] ??= []).push(i)
  })

  if (rank === 'four-of-a-kind')
    return Object.values(byRank).find(idxs => idxs.length === 4) ?? []
  if (rank === 'three-of-a-kind')
    return Object.values(byRank).find(idxs => idxs.length === 3) ?? []
  if (rank === 'two-pair')
    return Object.values(byRank).filter(idxs => idxs.length === 2).flat()
  if (rank === 'jacks-or-better') {
    const entry = Object.entries(byRank).find(
      ([r, idxs]) => idxs.length === 2 && rankVal(r as Rank) >= 11
    )
    return entry?.[1] ?? []
  }
  return [0, 1, 2, 3, 4]
}

export function evaluateHand(hand: Card[]): PokerHandRank {
  const ranks    = hand.map(c => rankVal(c.rank)).sort((a, b) => a - b)
  const suits    = hand.map(c => c.suit)
  const counts: Record<number, number> = {}
  for (const r of ranks) counts[r] = (counts[r] ?? 0) + 1
  const countVals = Object.values(counts).sort((a, b) => b - a)

  const isFlush         = suits.every(s => s === suits[0])
  const isNormal        = countVals[0] === 1 && ranks[4]! - ranks[0]! === 4
  const isWheel         = countVals[0] === 1 &&
    ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14
  const isStraight      = isNormal || isWheel
  const isRoyal         = isFlush && isNormal &&
    ranks[0] === 10 && ranks[1] === 11 && ranks[2] === 12 && ranks[3] === 13 && ranks[4] === 14

  if (isRoyal)                                    return 'royal-flush'
  if (isFlush && isStraight)                      return 'straight-flush'
  if (countVals[0] === 4)                         return 'four-of-a-kind'
  if (countVals[0] === 3 && countVals[1] === 2)   return 'full-house'
  if (isFlush)                                    return 'flush'
  if (isStraight)                                 return 'straight'
  if (countVals[0] === 3)                         return 'three-of-a-kind'
  if (countVals[0] === 2 && countVals[1] === 2)   return 'two-pair'
  if (countVals[0] === 2) {
    const pairRank = Number(Object.entries(counts).find(([, v]) => v === 2)?.[0] ?? 0)
    if (pairRank >= 11) return 'jacks-or-better'
  }
  return 'none'
}

export function initPoker(): PokerState {
  return {
    stage: 'betting',
    betAmount: 0,
    hand: [],
    held: [false, false, false, false, false],
    handRank: 'none',
    multiplier: 0,
    winningIndices: [],
    outcome: null,
    message: 'Place your bet to deal.',
  }
}

export function dealHand(bet: number): PokerState {
  const deck = shuffle(createDeck())
  return {
    stage: 'selecting',
    betAmount: bet,
    hand: deck.slice(0, 5),
    held: [false, false, false, false, false],
    handRank: 'none',
    multiplier: 0,
    winningIndices: [],
    outcome: null,
    message: 'Hold the cards you want to keep.',
  }
}

export function toggleHold(state: PokerState, index: number): PokerState {
  if (state.stage !== 'selecting') return state
  const held = [...state.held] as boolean[]
  held[index] = !held[index]
  return { ...state, held }
}

export function drawCards(state: PokerState): PokerState {
  const usedKeys = new Set(
    state.hand.filter((_, i) => state.held[i]).map(c => `${c.rank}${c.suit}`)
  )
  const pool = shuffle(createDeck()).filter(c => !usedKeys.has(`${c.rank}${c.suit}`))
  let poolIdx = 0
  const newHand: Card[] = state.hand.map((card, i) =>
    state.held[i] ? card : pool[poolIdx++]!
  )

  const handRank      = evaluateHand(newHand)
  const multiplier    = HAND_PAYOUTS[handRank]
  const winningIndices = getWinningIndices(newHand, handRank)

  return {
    ...state,
    stage: 'settled',
    hand: newHand,
    held: [false, false, false, false, false],
    handRank,
    multiplier,
    winningIndices,
    outcome: multiplier > 0 ? 'win' : 'loss',
    message: multiplier > 0 ? `${HAND_LABELS[handRank]}!` : 'No winning hand.',
  }
}
