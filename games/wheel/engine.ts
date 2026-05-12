import type { WheelColor, WheelSegment, WheelState } from './types'

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { color: 'red',   multiplier: 2, count: 20, label: '2×' },
  { color: 'blue',  multiplier: 3, count: 12, label: '3×' },
  { color: 'green', multiplier: 4, count: 6,  label: '4×' },
  { color: 'gold',  multiplier: 5, count: 3,  label: '5×' },
]

const TOTAL_SLOTS = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.count, 0) // 41

export const SEGMENT_DEGREES: Record<WheelColor, { start: number; end: number; mid: number }> = {
  red:   { start: 0,      end: 175.6, mid: 87.8   },
  blue:  { start: 175.6,  end: 281.0, mid: 228.3  },
  green: { start: 281.0,  end: 333.7, mid: 307.35 },
  gold:  { start: 333.7,  end: 360.0, mid: 346.85 },
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

export function getWinChance(color: WheelColor): number {
  const seg = WHEEL_SEGMENTS.find((s) => s.color === color)!
  return seg.count / TOTAL_SLOTS
}
