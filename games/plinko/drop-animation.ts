import { PLINKO_ROWS, PLINKO_SLOT_COUNT } from './engine'
import { ROW_BAND, SLOT_BAND_HEIGHT, SLOT_RECT_Y, getBallX, getPinX, getPinY } from './board-geometry'

export const PLINKO_DROP_STAGGER_MS = 90

/** Time allocated to each pin row, in ms. */
const ROW_MS = 500
/** Extra ms after the last pin for the ball to settle into the slot tray. */
const LAND_MS = 280

export const PLINKO_DROP_DURATION_MS = PLINKO_ROWS * ROW_MS + LAND_MS

/** Physical radii (must match the component's PIN_R / BALL_R). */
const PIN_R = 5
const BALL_R = 7
/** Distance from pin center to ball center at side-contact. */
const CONTACT_R = PIN_R + BALL_R

export interface PlinkoPoint {
  x: number
  y: number
}

export interface PlinkoDropTrack {
  frames: Array<{ x: number; y: number; t: number }>
  durationMs: number
}

/** Which physical pin column the ball hits at this row given the slot transition. */
function hitPinCol(row: number, fromSlot: number, toSlot: number): number {
  const delta = toSlot - fromSlot
  const fc = Math.round(fromSlot - (PLINKO_ROWS - row) / 2)
  if (delta > 0) return Math.min(row, fc + 1)
  if (delta < 0) return Math.max(0, fc - 1)
  return Math.min(row, Math.max(0, fc))
}

/** Decide which side the ball slides off: right (+1) or left (-1). */
function slideDir(fromSlot: number, toSlot: number): 1 | -1 {
  if (toSlot > fromSlot) return 1
  if (toSlot < fromSlot) return -1
  // clamped at board edge — bounce toward center
  return fromSlot <= (PLINKO_SLOT_COUNT - 1) / 2 ? 1 : -1
}

/**
 * Build a keyframe track for one ball drop.
 *
 * Each pin row is split into four phases that make the 50/50 decision visible:
 *   0 % → 48 %  fall from the inter-row channel to just above the pin
 *  48 % → 64 %  slide clearly left or right around the pin (the decision!)
 *  64 % → 80 %  exit downward below the pin toward the next slot
 *  80 % → 100 % glide through the channel to the next row's entry point
 *
 * Sampling uses smoothstep easing within each segment so the ball decelerates
 * at every pin instead of zipping through at constant speed.
 */
export function buildPlinkoDropTrack(path: number[]): PlinkoDropTrack {
  const frames: Array<{ x: number; y: number; t: number }> = []

  // Ball starts just above the board, directly over the starting slot.
  frames.push({ x: getBallX(0, path[0] ?? 5), y: -BALL_R, t: 0 })

  for (let row = 0; row < PLINKO_ROWS; row++) {
    const tBase = row * ROW_MS
    const fromSlot = path[row] ?? 5
    const toSlot = path[row + 1] ?? fromSlot
    const dir = slideDir(fromSlot, toSlot)
    const pc = hitPinCol(row, fromSlot, toSlot)
    const px = getPinX(row, pc)
    const py = getPinY(row)
    const fromX = getBallX(0, fromSlot)
    const nextX = getBallX(0, toSlot)

    // Near-edge damping: reduce the lateral contact offset when the ball is moving
    // toward the wall so it doesn't appear to shoot off the side of the board.
    const wallDist = dir === 1 ? PLINKO_SLOT_COUNT - 1 - toSlot : toSlot
    const edgeScale = Math.min(1, wallDist / 2)  // full at 2+ slots from wall, tapers to 0
    const contactOffset = dir * CONTACT_R * Math.max(0.15, edgeScale)

    // The staggered pin grid means px can be behind the ball's direction of travel
    // (e.g. ball at slot 7 going right, but the target pin is to its left at row 2).
    // Clamp both approach and contact x so Phase 1 and Phase 2 never move counter
    // to the travel direction — that counter-movement was reading as an edge boost.
    const approachX = dir === 1 ? Math.max(fromX, px) : Math.min(fromX, px)
    const rawContactX = px + contactOffset
    const contactX = dir === 1 ? Math.max(approachX, rawContactX) : Math.min(approachX, rawContactX)

    // Phase 1: fall to just above the pin (clamped so it never drifts against travel)
    frames.push({ x: approachX, y: py - CONTACT_R, t: tBase + ROW_MS * 0.48 })
    // Phase 2: slide to the side of the pin — visually shows left or right decision
    frames.push({ x: contactX, y: py, t: tBase + ROW_MS * 0.64 })
    // Phase 3: exit below the pin moving toward the next slot column
    frames.push({ x: nextX, y: py + CONTACT_R + 4, t: tBase + ROW_MS * 0.80 })
    // Phase 4: channel glide — drift to the x-position the ball will occupy at the next pin
    frames.push({ x: nextX, y: py + ROW_BAND * 0.46, t: tBase + ROW_MS })
  }

  // Land in the slot tray
  const finalSlot = path[PLINKO_ROWS] ?? path[path.length - 1] ?? 5
  frames.push({
    x: getBallX(0, finalSlot),
    y: SLOT_RECT_Y + SLOT_BAND_HEIGHT * 0.45,
    t: PLINKO_ROWS * ROW_MS + LAND_MS,
  })

  return { frames, durationMs: PLINKO_DROP_DURATION_MS }
}

export function samplePlinkoDropTrack(track: PlinkoDropTrack, elapsedMs: number): PlinkoPoint {
  const { frames } = track
  if (!frames.length) return { x: 0, y: 0 }
  if (elapsedMs <= 0) return { x: frames[0]!.x, y: frames[0]!.y }
  const last = frames[frames.length - 1]!
  if (elapsedMs >= last.t) return { x: last.x, y: last.y }

  // Binary search for the surrounding keyframe pair
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid]!.t < elapsedMs) lo = mid
    else hi = mid
  }

  const a = frames[lo]!
  const b = frames[hi]!
  const u = (elapsedMs - a.t) / (b.t - a.t)
  // Smoothstep: decelerates at each keyframe so pin contacts feel deliberate
  const s = u * u * (3 - 2 * u)
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s }
}

export function plinkoDropEndMs(ballCount: number): number {
  return (ballCount - 1) * PLINKO_DROP_STAGGER_MS + PLINKO_DROP_DURATION_MS
}
