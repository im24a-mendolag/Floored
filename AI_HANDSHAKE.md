# Floored — AI Handshake File

> Read this before touching anything. It captures decisions, gotchas, and current state
> that aren't obvious from reading the code alone.

---

## What this project is

**Floored** is a Next.js 14 (App Router) gambling-simulation platform with freeplay and
survival modes. Players start with a bankroll and play casino-style games. There is no real
money — it's a frontend-only project.

Tech: Next.js 14 App Router · TypeScript · Tailwind CSS (JIT) · Zustand stores · `'use client'` components throughout.

---

## Key files to know

| Path | Purpose |
|---|---|
| `GAME_TEMPLATE.txt` | **The law.** All conventions for building a new game. Read before writing any game code. |
| `components/game-layout.ts` | Exports `GAME_CARD_SHELL`, `GAME_BOARD_ARENA`, `GAME_CONTROL_DOCK_M`, `GAME_STATUS_BAR` — layout constants shared by all games. |
| `components/game-match-history.tsx` | `GameFieldWithHistory` — board wrapper with slide-out history panel. |
| `components/lobby.tsx` | Game grid for freeplay/survival. Edit `GAMES[]` to add/unlock games. |
| `store/types.ts` | `GameName` union type — must be kept in sync with `GAMES[]` in lobby.tsx. |
| `store/freeplay-store.ts` | Bankroll, bust flag, reset for freeplay mode. |
| `store/survival-store.ts` | Bankroll, floor, min-bet for survival mode. |
| `store/settings-store.ts` | `autoReBet` toggle used by all games. |
| `utils/format.ts` | `formatChips`, `formatMultiplier` — always use these, never format numbers manually. |

---

## Games inventory

| Game | Freeplay | Survival | Engine | Component |
|---|---|---|---|---|
| Blackjack | ✓ | ✓ | `games/blackjack/` | `components/blackjack-game.tsx` |
| Crash | ✓ | ✓ | `games/crash/` | `components/crash-game.tsx` |
| Plinko | ✓ | — | `games/plinko/` | `components/plinko-game.tsx` |
| Over-Under | ✓ | — | `games/over-under/` | `components/over-under-game.tsx` |
| Fortune Wheel | ✓ | — | `games/wheel/` | `components/wheel-game.tsx` |
| Run Dice | ✓ | — | `games/run-dice/` | `components/run-dice-game.tsx` |
| Mines | ✓ | — | `games/mines/` | `components/mines-game.tsx` |
| Chicken Road | ✓ | — | `games/chicken-road/` | `components/chicken-road-game.tsx` |
| Slots | ✓ | — | `games/slots/` | `components/slots-game.tsx` |
| Roulette | ✓ | ✓ | `games/roulette/` | `components/roulette-game.tsx` |
| Dragon Tower | ✓ | — | `games/dragon-tower/` | `components/dragon-tower-game.tsx` |
| Chicken Race | ✓ | — | `games/chicken-race/` | `components/chicken-race-game.tsx` |
| Coin Flip | ✓ | — | `games/coin-flip/` | `components/coin-flip-game.tsx` |
| Case Battles | ✓ | — | `games/case-battles/` | `components/case-battles-game.tsx` |
| 1P Poker | ✓ | — | `games/poker-1p/` | `components/poker-1p-game.tsx` |
| HiLo | — | — | (stub) | (stub) |
| Flipper | — | — | (stub) | — |
| Street Cups | — | — | (stub) | — |

Games marked `—` in Survival are lobby-locked (`availableSurvival: false`). Games with both
columns `—` are listed in lobby as "Coming soon" (`availableFreeplay: false, availableSurvival: false`).

---

## Non-obvious conventions

### Layout stability (most important)
**Board arena:** Playfield and surrounding UI must not shift between game-loop phases (betting /
playing / settled). Use a fixed-height stack in the board (stats, selectors, playfield, hints)
with `invisible pointer-events-none` instead of conditional mount. Anchor with `justify-start`
on the arena. See `GAME_TEMPLATE.txt` section 6 and `components/mines-game.tsx`.

**Control dock:** The dock must never resize when transitioning between phases.
The rule: **never conditionally render elements that have height in the control zone.**
Instead use two techniques:
- `invisible pointer-events-none` — hides visually but keeps DOM space (use for chip row)
- Fixed-height wrapper `h-10 flex items-center justify-center` — keeps height stable while
  swapping inner content with normal `{condition && <...>}` (use for info row)
- Single adaptive button — one `<button>` whose `onClick`, label, and className change per
  phase. Never three separate conditionally-rendered buttons.

See section 7 of `GAME_TEMPLATE.txt` for the exact DOM structure.
Reference: `components/chicken-race-game.tsx` and `components/dragon-tower-game.tsx`.

### Tailwind JIT + data objects
Tailwind JIT only scans `.tsx`/`.ts` files for class names at build time. If a color class
is constructed from a string in a data array (e.g. `bg-${chicken.color}-500`), it will NOT
be included in the bundle and will silently render nothing.

**Rule:** store colors as hex strings in engine data (`'#ef4444'`) and apply them via inline
`style={{ backgroundColor: chicken.color }}`. Never build Tailwind class names from data.

### Engine purity
`games/<name>/engine.ts` must be pure functions with zero React imports and zero side effects.
All randomness lives in the engine. The component calls engine functions and manages UI state.
Engine functions: `init<Game>()`, `start<Game>(bet)`, `<action>(state, args)`, `settle<Game>(state)`.

### Survival mode min-bet
```ts
const minBet = mode === 'survival' ? floorMinBet : 1
const canAct = currentBet >= minBet && currentBet <= bankroll
```
Always gate the start action on `canAct`, not just `currentBet > 0`.

### onResolve contract
The page (`app/freeplay/<game>/page.tsx`) owns bankroll math. The component never reads or
writes the bankroll store directly — it only calls `onResolve({ outcome, betAmount, payout, multiplier })`.
Page then does `newBankroll = bankroll - betAmount + payout`.

### Match history
History entries are staged in `pendingResult` state and pushed to `matchHistory` on the
*next* round (inside `handleNext`), not immediately on resolve. This gives the player a
chance to see the result before it scrolls into history.
Push pattern: `setMatchHistory(h => [entry, ...h].slice(0, 80))`

### autoReBet
```ts
const { autoReBet } = useSettingsStore()
// in handleNext:
if (autoReBet && lastBet <= bankroll) setCurrentBet(lastBet)
```
Some games also restore `lastPicked` (e.g. Chicken Race restores the previously picked chicken).

---

## Roulette specifics
- Bet types: `'red' | 'black' | 'odd' | 'even' | number (0–36)`
- Selected bet type highlighted in **yellow** (`bg-yellow-400 border-yellow-300 text-zinc-900`)
- Player can change their selected tile even after chips are placed
- Bet+target overlay shown only during spinning, not during betting
- Odd/even logic: `n % 2 === 1` → odd, `n % 2 === 0` → even (0 is even but loses on even bets — house rule, check engine)

## Dragon Tower specifics
- 5 floors × 3 tiles, one hidden dragon per row
- Multipliers bottom→top: `[1.40, 1.96, 2.74, 3.84, 5.38]`
- Cash out only available after clearing at least one floor (`cashoutMultiplier > 0`)
- On bust: ALL rows revealed (not just the active one) — `rows.map(r => ({ ...r, revealed: true }))`
- Active row accent: fuchsia (`bg-fuchsia-950/30 ring-1 ring-fuchsia-800/50`)

## Chicken Race specifics
- 4 chickens: Nugget (red `#ef4444`), Clucky (blue `#3b82f6`), Feathers (green `#10b981`), Goldie (yellow `#eab308`)
- Equal 25% win probability each, 3.60× payout
- Animation: `RACE_TICKS = 36`, `TICK_MS = 90ms`, easeInOutCubic curve with per-chicken phase offsets
- Progress is monotonically enforced: `raw[f][c] = Math.max(raw[f-1][c], raw[f][c])`
- Payout label shown once above all lanes, not per-chicken
- Chicken emoji rider is always rendered in the track (invisible during betting) — prevents height shift

---

## Game UI rollout checklist

Standardize every `components/<game>-game.tsx` to match `GAME_TEMPLATE.txt` (sections 6–7) and `components/mines-game.tsx`.

| Game | Status | Notes |
|------|--------|-------|
| **mines** | **done** | Reference implementation |
| **keno** | **done** | Quick-pick rebet; settled = chips returned, history = net |
| **blackjack** | **done** | Push; double deducts extra bet on `onBet` |
| **crash** | **done** | Potential winnings in dock only |
| **plinko** | **done** | Continuous drop; ball count badge |
| **over-under** | **done** | Safe-zone badge; roll animation |
| **wheel** | **done** | Color picker row in dock |
| **run-dice** | **done** | Push; multi-roll in-progress |
| **chicken-road** | **done** | Centered road; fixed-height playfield |
| **slots** | **done** | `GAME_CONTROL_DOCK_M`; paytable always visible |
| **roulette** | **done** | Push; red/black/odd/even below table |
| **dragon-tower** | **done** | Centered tower; no post-game row markers |
| **chicken-race** | **done** | Race lanes fixed height; potential winnings in dock |
| **coin-flip** | **done** | Streak ride; cash out + flip again; quote while flipping |
| **case-battles** | **done** | Case picker (no chip row); quote until Next |
| **poker-1p** | **done** | Pay table on board; quote from deal to Next |
| **hilo** | **done** | Streak ride; quote from deal to Next |
| **street-cups** | **done** | Quote through round; potential winnings while picking |

**Per-game requirements**

1. `GameDockBetRow` — inline Clear beside bet (Dragon Tower style)
2. `GameActiveBetBadge` — bet + bet type (Plinko: ball value) top-left while round active
3. `onBet` on start + page uses `useFreeplayGameBankroll` / `useSurvivalGameBankroll`
4. Settled dock: **total winnings**; match history: **net** (`buildPendingResult`)
5. **Potential total winnings** only in control dock (not duplicated on board)
6. `GameDockChipRow` + `pickQuote` — quote in chip row slot while playing
7. Instructions in **board** (`min-h-10` hint slot), not control dock
8. Chip row includes **¼, ½, All In** (except case-battles)
9. `GameDockBackButton` while betting
10. Rebet via `autoReBet` (+ Keno: auto quick-pick if last round used it)
11. Push returns stake (`payout === betAmount`)
12. `GAME_DOCK_INNER` + `justify-between` — even control spacing
13. `GAME_CONTROL_DOCK_M` (not custom `h-[284px]` docks)
14. Board stack fixed height — playfield must not move between phases

---

## Adding a new game — checklist

1. `games/<name>/types.ts` — state interface + stage union
2. `games/<name>/engine.ts` — pure init/start/action/settle functions
3. Add `'<name>'` to `GameName` union in `store/types.ts`
4. Add entry to `GAMES[]` in `components/lobby.tsx`
5. `components/<name>-game.tsx` — follow GAME_TEMPLATE.txt exactly
6. `app/freeplay/<name>/page.tsx` — freeplay page (see template section 2)
7. `app/survival/<name>/page.tsx` — survival page (only if `availableSurvival: true`)

Pick an unused lobby color for the accent (see lobby.tsx comments for which color each game uses).
