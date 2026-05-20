import type { HiLoCard, HiLoState } from './types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
}

/** multiplier(streak) = 2 × 1.5^(streak−1), rounded to 2 dp. */
export function streakMultiplier(streak: number): number {
  return Math.round(2 * Math.pow(1.5, streak - 1) * 100) / 100
}

function buildDeck(): HiLoCard[] {
  const deck: HiLoCard[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: RANK_VALUES[rank] ?? 0 })
    }
  }
  return deck
}

function shuffleDeck<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]; a[i] = a[j]!; a[j] = tmp!
  }
  return a
}

export function initHiLo(): HiLoState {
  return {
    deck: [],
    currentCard: null,
    nextCard: null,
    betAmount: 0,
    stage: 'betting',
    outcome: null,
    lastGuess: null,
    streak: 0,
    multiplier: 0,
    message: 'Place your bet.',
  }
}

export function startHiLoRound(betAmount: number): HiLoState {
  const deck = shuffleDeck(buildDeck())
  // Never deal A or 2 as the opening card — one side is always an impossible guess
  const startIdx = deck.findIndex((c) => c.value > 2 && c.value < 14)
  const [currentCard = null] = deck.splice(startIdx, 1)
  return {
    deck,
    currentCard,
    nextCard: null,
    betAmount,
    stage: 'playing',
    outcome: null,
    lastGuess: null,
    streak: 0,
    multiplier: 0,
    message: 'Higher or Lower?',
  }
}

export function guessHiLo(state: HiLoState, guess: 'higher' | 'lower'): HiLoState {
  const deck = [...state.deck]
  const nextCard = deck.pop()!
  const current = state.currentCard!

  const isWin =
    guess === 'higher'
      ? nextCard.value > current.value
      : nextCard.value < current.value

  if (isWin) {
    const newStreak = state.streak + 1
    const newMult = streakMultiplier(newStreak)
    return {
      ...state,
      deck,
      nextCard,
      lastGuess: guess,
      streak: newStreak,
      multiplier: newMult,
      stage: 'riding',
      message: `${nextCard.rank}${nextCard.suit} — ${newMult}× · Cash out or go again?`,
    }
  }

  const message =
    nextCard.value === current.value
      ? `${nextCard.rank}${nextCard.suit} — Tie. House wins.`
      : `${nextCard.rank}${nextCard.suit} — Wrong call.`

  return {
    ...state,
    deck,
    nextCard,
    lastGuess: guess,
    outcome: 'loss',
    stage: 'settled',
    message,
  }
}

/** Blessed guess: forces a card from the deck that makes the guess correct; returns 'riding'. */
export function winGame(state: HiLoState, guess: 'higher' | 'lower'): HiLoState {
  if (state.stage !== 'playing' && state.stage !== 'riding') return state
  const current = state.currentCard!
  const winners = state.deck.filter((c) =>
    guess === 'higher' ? c.value > current.value : c.value < current.value
  )
  if (winners.length === 0) return guessHiLo(state, guess)
  const nextCard = winners[Math.floor(Math.random() * winners.length)]!
  const deck = state.deck.filter((c) => c !== nextCard)
  const newStreak = state.streak + 1
  const newMult = streakMultiplier(newStreak)
  return {
    ...state,
    deck,
    nextCard,
    lastGuess: guess,
    streak: newStreak,
    multiplier: newMult,
    stage: 'riding',
    message: `${nextCard.rank}${nextCard.suit} — ${newMult}× · Cash out or go again?`,
  }
}

/** Cursed guess: forces a card from the deck that makes the guess wrong. */
export function loseGame(state: HiLoState, guess: 'higher' | 'lower'): HiLoState {
  if (state.stage !== 'playing' && state.stage !== 'riding') return state
  const current = state.currentCard!
  const losers = state.deck.filter((c) =>
    guess === 'higher' ? c.value <= current.value : c.value >= current.value
  )
  if (losers.length === 0) return guessHiLo(state, guess)
  const nextCard = losers[Math.floor(Math.random() * losers.length)]!
  const deck = state.deck.filter((c) => c !== nextCard)
  const message =
    nextCard.value === current.value
      ? `${nextCard.rank}${nextCard.suit} — Tie. House wins.`
      : `${nextCard.rank}${nextCard.suit} — Wrong call.`
  return {
    ...state,
    deck,
    nextCard,
    lastGuess: guess,
    outcome: 'loss',
    stage: 'settled',
    message,
  }
}

/** Player cashes out — locks in the current multiplier as a win. */
export function cashOutHiLo(state: HiLoState): HiLoState {
  return {
    ...state,
    outcome: 'win',
    stage: 'settled',
    message: `Cashed out at ${state.multiplier}×!`,
  }
}

/** Player goes again — last revealed card becomes the current card; bet on the next. */
export function goAgainHiLo(state: HiLoState): HiLoState {
  return {
    ...state,
    currentCard: state.nextCard,
    nextCard: null,
    lastGuess: null,
    stage: 'playing',
    message: 'Higher or Lower?',
  }
}
