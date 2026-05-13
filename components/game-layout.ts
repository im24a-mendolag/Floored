/**
 * Shared layout shell so table games match Blackjack / Crash proportions
 * inside the page column (max width + flex arena + control dock).
 */
/** Frame without background — use with inline gradient for legacy games. */
export const GAME_CARD_FRAME =
  'flex-1 min-h-0 w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-zinc-800'

export const GAME_CARD_SHELL = `${GAME_CARD_FRAME} bg-zinc-950`

export const GAME_STATUS_BAR =
  'shrink-0 px-5 py-2 bg-black flex items-center justify-between border-b border-zinc-800 rounded-t-2xl'

/** Flex arena: grows like Crash / Plinko; add your own flex direction / padding inside. */
export const GAME_BOARD_ARENA =
  'flex-1 min-h-0 w-full min-h-[min(360px,52vh)] relative overflow-hidden'

/** Centered curve / SVG field (Crash baseline). */
export const GAME_BOARD_ARENA_CENTER = `${GAME_BOARD_ARENA} flex items-center justify-center`

export const GAME_CONTROL_DOCK =
  'shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 py-1 rounded-b-2xl'

/** Fixed-height control shells — swap inner panels without collapsing the dock. */
export const GAME_CONTROL_DOCK_S =
  `${GAME_CONTROL_DOCK} relative flex min-h-[200px] flex-col justify-center`
export const GAME_CONTROL_DOCK_M =
  `${GAME_CONTROL_DOCK} relative flex min-h-[200px] flex-col justify-center`
export const GAME_CONTROL_DOCK_L =
  `${GAME_CONTROL_DOCK} relative flex min-h-[360px] flex-col justify-center`
