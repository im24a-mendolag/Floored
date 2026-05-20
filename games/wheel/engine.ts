import type { WheelColor, WheelSegment, WheelState } from './types'

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { color: 'red',   multiplier: 2, count: 6, label: '2×' },
  { color: 'blue',  multiplier: 3, count: 3, label: '3×' },
  { color: 'green', multiplier: 4, count: 2, label: '4×' },
  { color: 'gold',  multiplier: 5, count: 1, label: '5×' },
]

const TOTAL_SLOTS = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.count, 0) // 12

// No-adjacent layout (30° per slice, mid = slice_index × 30 + 15):
// R(15°) B(45°) R(75°) G(105°) R(135°) B(165°) R(195°) Gold(225°) R(255°) G(285°) R(315°) B(345°)
// To land a slice's element_angle under the top pointer after CSS rotate(θ):
//   screen_angle = (element_angle + θ) % 360  →  for screen_angle=0: θ = (360 - element_angle) % 360
//   mid must equal (360 - representative_element_angle) % 360
export const SEGMENT_DEGREES: Record<WheelColor, { start: number; end: number; mid: number }> = {
  red:   { start: 0, end: 360, mid: 225 }, // 360 - 135 (slice 4)
  blue:  { start: 0, end: 360, mid: 315 }, // 360 - 045 (slice 1)
  green: { start: 0, end: 360, mid: 255 }, // 360 - 105 (slice 3)
  gold:  { start: 0, end: 360, mid: 135 }, // 360 - 225 (slice 7)
}

function pickResultColor(): WheelColor {
  const roll = Math.random() * TOTAL_SLOTS
  let cumulative = 0
  let resultSegment: WheelSegment = WHEEL_SEGMENTS[WHEEL_SEGMENTS.length - 1]!
  for (const seg of WHEEL_SEGMENTS) {
    cumulative += seg.count
    if (roll < cumulative) {
      resultSegment = seg
      break
    }
  }
  return resultSegment.color
}

/** Pre-roll for scout perk — same landing color used when the spin starts. */
export function previewWheelOutcome(): { resultColor: WheelColor; crossedOutColor: WheelColor } {
  const resultColor = pickResultColor()
  const losingColors = WHEEL_SEGMENTS.map((s) => s.color).filter((c) => c !== resultColor)
  const uniqueLosing = Array.from(new Set(losingColors)) as WheelColor[]
  const crossedOutColor = uniqueLosing[Math.floor(Math.random() * uniqueLosing.length)]!
  return { resultColor, crossedOutColor }
}

export function initWheel(): WheelState {
  return {
    stage: 'betting',
    betColor: 'red',
    betAmount: 0,
    resultColor: null,
    resultMultiplier: 0,
    outcome: null,
    payoutMultiplier: 0,
    message: 'Pick a color and spin.',
  }
}

export function spinWheel(betColor: WheelColor, betAmount: number): WheelState {
  return spinWheelWithResult(betColor, betAmount, pickResultColor())
}

export function spinWheelWithResult(
  betColor: WheelColor,
  betAmount: number,
  resultColor: WheelColor,
): WheelState {
  const resultSegment = WHEEL_SEGMENTS.find((s) => s.color === resultColor)!
  const won = resultSegment.color === betColor

  return {
    stage: 'settled',
    betColor,
    betAmount,
    resultColor: resultSegment.color,
    resultMultiplier: resultSegment.multiplier,
    outcome: won ? 'win' : 'loss',
    payoutMultiplier: won ? resultSegment.multiplier : 0,
    message: won
      ? `${resultSegment.multiplier}× — You win!`
      : `${resultSegment.multiplier}× — No match.`,
  }
}

/** Calculate CSS rotation (in degrees) to land on a result color from the current rotation */
export function getTargetRotation(currentRotation: number, resultColor: WheelColor): number {
  const mid = SEGMENT_DEGREES[resultColor].mid
  const currMod = currentRotation % 360
  const extra = (mid - currMod + 360) % 360
  // 5 full spins + correction to land exactly on result midpoint
  return currentRotation + 1800 + extra
}

export function getWheelPayout(state: WheelState): number {
  return state.outcome === 'win' ? state.betAmount * state.payoutMultiplier : 0
}

/**
 * Blessed spin: the wheel always lands on the player's bet color.
 * Uses spinWheelWithResult so the animation is identical.
 */
export function winGame(betColor: WheelColor, betAmount: number): WheelState {
  return spinWheelWithResult(betColor, betAmount, betColor)
}

/**
 * Cursed spin: picks a random color that is NOT the player's bet so the
 * wheel always misses. Uses spinWheelWithResult so the animation is identical.
 */
export function loseGame(betColor: WheelColor, betAmount: number): WheelState {
  const losers = WHEEL_SEGMENTS.map((s) => s.color).filter((c) => c !== betColor) as WheelColor[]
  const resultColor = losers[Math.floor(Math.random() * losers.length)]!
  return spinWheelWithResult(betColor, betAmount, resultColor)
}

export function getWinChance(color: WheelColor): number {
  const seg = WHEEL_SEGMENTS.find((s) => s.color === color)!
  return seg.count / TOTAL_SLOTS
}
