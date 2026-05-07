import type {
  BlackjackCard,
  BlackjackOutcome,
  BlackjackState,
  GameEngine,
} from './types'

const SUITS: BlackjackCard['suit'][] = ['♠', '♥', '♦', '♣']
const RANKS: BlackjackCard['rank'][] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

function newDeck(): BlackjackCard[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })))
}

function shuffle(deck: BlackjackCard[]): BlackjackCard[] {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]!
    result[i] = result[j]!
    result[j] = temp
  }
  return result
}

function cardValues(card: BlackjackCard): number[] {
  if (card.rank === 'A') return [1, 11]
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return [10]
  return [parseInt(card.rank, 10)]
}

function handTotals(cards: BlackjackCard[]): number[] {
  const totals = cards.reduce<number[]>((acc, card) => {
    const values = cardValues(card)
    return acc.flatMap((total) => values.map((value) => total + value))
  }, [0])

  return Array.from(new Set(totals)).sort((a, b) => a - b)
}

export function calculateHandValue(cards: BlackjackCard[]): number {
  const totals = handTotals(cards)
  const validTotals = totals.filter((value) => value <= 21)
  return validTotals.length > 0 ? Math.max(...validTotals) : Math.min(...totals)
}

function isBust(cards: BlackjackCard[]): boolean {
  return handTotals(cards).every((total) => total > 21)
}

function isBlackjack(cards: BlackjackCard[]): boolean {
  return cards.length === 2 && handTotals(cards).includes(21)
}

function dealerShouldHit(cards: BlackjackCard[]): boolean {
  const totals = handTotals(cards).filter((total) => total <= 21)
  if (totals.length === 0) return false
  return Math.max(...totals) < 17
}

function playDealer(deck: BlackjackCard[], dealerHand: BlackjackCard[]) {
  let currentDeck = [...deck]
  let currentHand = [...dealerHand]

  while (dealerShouldHit(currentHand)) {
    const [next, ...rest] = currentDeck
    if (!next) break
    currentHand = [...currentHand, next]
    currentDeck = rest
  }

  return { dealerHand: currentHand, deck: currentDeck }
}

function settle(state: BlackjackState, outcome: BlackjackOutcome): BlackjackState {
  const multiplier =
    outcome === 'win'
      ? state.playerBlackjack
        ? 2.5
        : 2
      : outcome === 'push'
      ? 1
      : 0

  const message =
    outcome === 'win'
      ? state.playerBlackjack
        ? 'Blackjack! You win.'
        : 'You win.'
      : outcome === 'push'
      ? 'Push. Your bet is returned.'
      : 'You lose.'

  return {
    ...state,
    stage: 'settled',
    outcome,
    payoutMultiplier: multiplier,
    message,
    canDouble: false,
  }
}

export function initBlackjack(): BlackjackState {
  return {
    deck: shuffle(newDeck()),
    playerHand: [],
    dealerHand: [],
    betAmount: 0,
    stage: 'betting',
    outcome: null,
    payoutMultiplier: 1,
    message: 'Place your bet.',
    canDouble: false,
    playerBlackjack: false,
    dealerBlackjack: false,
  }
}


export function startBlackjackRound(betAmount: number): BlackjackState {
  const deck = shuffle(newDeck())
  const [playerOne, dealerOne, playerTwo, dealerTwo, ...rest] = deck
  const playerHand = [playerOne!, playerTwo!]
  const dealerHand = [dealerOne!, dealerTwo!]
  const playerBlackjack = isBlackjack(playerHand)
  const dealerBlackjack = isBlackjack(dealerHand)
  const initialState: BlackjackState = {
    deck: rest,
    playerHand,
    dealerHand,
    betAmount,
    stage: playerBlackjack || dealerBlackjack ? 'settled' : 'inProgress',
    outcome: null,
    payoutMultiplier: 1,
    message: 'Your move.',
    canDouble: !playerBlackjack && !dealerBlackjack,
    playerBlackjack,
    dealerBlackjack,
  }

  if (playerBlackjack || dealerBlackjack) {
    const outcome: BlackjackOutcome = playerBlackjack
      ? dealerBlackjack
        ? 'push'
        : 'win'
      : 'loss'
    return settle(initialState, outcome)
  }

  return initialState
}

export function hitBlackjack(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const [next, ...rest] = state.deck
  if (!next) return { ...state, stage: 'settled', outcome: 'loss', message: 'No cards left.', canDouble: false }

  const nextState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    canDouble: false,
    message: 'You hit.',
  }

  if (isBust(nextState.playerHand)) {
    return settle(nextState, 'loss')
  }

  return nextState
}

export function standBlackjack(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const { dealerHand, deck } = playDealer(state.deck, state.dealerHand)
  const nextState = {
    ...state,
    deck,
    dealerHand,
    message: 'Dealer plays.',
    canDouble: false,
  }

  if (isBust(dealerHand)) {
    return settle(nextState, 'win')
  }

  const playerValue = calculateHandValue(state.playerHand)
  const dealerValue = calculateHandValue(dealerHand)

  if (playerValue > dealerValue) return settle(nextState, 'win')
  if (playerValue === dealerValue) return settle(nextState, 'push')
  return settle(nextState, 'loss')
}

export function doubleDownBlackjack(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress' || state.playerHand.length !== 2) return state
  const [next, ...rest] = state.deck
  if (!next) return { ...state, stage: 'settled', outcome: 'loss', message: 'No cards left.', canDouble: false }

  const doubledState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    betAmount: state.betAmount * 2,
    canDouble: false,
    message: 'Double down.',
  }

  if (isBust(doubledState.playerHand)) {
    return settle(doubledState, 'loss')
  }

  return standBlackjack(doubledState)
}

export const blackjackEngine: GameEngine<BlackjackState, void> = {
  init: () => initBlackjack(),
  start: (betAmount) => startBlackjackRound(betAmount),
  resolve: (outcome, state) => settle(state, outcome),
  getPayoutMultiplier: (state) => state.payoutMultiplier,
}
