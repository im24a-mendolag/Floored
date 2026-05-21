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
| `store/types.ts` | `GameName` union + `Difficulty` + `GameMode` types — keep in sync with `GAMES[]`. |
| `store/freeplay-store.ts` | Bankroll, bust flag, reset for freeplay mode. |
| `store/survival-store.ts` | Full survival run state — see section below. |
| `store/settings-store.ts` | `autoReBet`, `forceTie`, dev-mode toggles. |
| `utils/format.ts` | `formatChips`, `formatMultiplier` — always use these, never format numbers manually. |
| `utils/math.ts` | `FLOOR_MIN_BETS`, `getFloorMinBet(floor)`, `calculatePayout(bet, multiplier)`. |
| `lib/survival/balance.ts` | All survival constants: quota curve, difficulty mults, floor timer, sparks, etc. |
| `lib/survival/survival-perks.ts` | Perk helpers — `hasEffect`, `computePayoutMultiplier`, game-specific perk accessors. |
| `lib/survival/upgrades-catalog.ts` | `UPGRADES_CATALOG` + helpers to query/validate upgrade purchases. |
| `lib/survival/upgrade-levels.ts` | Level costs and per-level values for all upgrade tracks. |
| `hooks/use-floor-timer.ts` | `useFloorTimer()` effect + `useFloorTimeRemainingMs()` + `formatFloorTime(ms)`. |
| `hooks/use-survival-perks.ts` | `useSurvivalPerks(game)` — all perk booleans + `boostedPotential()`. |

---

## Games inventory

All 18 games are available in both freeplay and survival.

| Game | Engine | Component | Lobby accent |
|---|---|---|---|
| Blackjack | `games/blackjack/` | `components/blackjack-game.tsx` | red |
| Crash | `games/crash/` | `components/crash-game.tsx` | teal |
| Plinko | `games/plinko/` | `components/plinko-game.tsx` | amber |
| Over-Under | `games/over-under/` | `components/over-under-game.tsx` | indigo |
| Fortune Wheel | `games/wheel/` | `components/wheel-game.tsx` | lime |
| Run Dice | `games/run-dice/` | `components/run-dice-game.tsx` | violet |
| Mines | `games/mines/` | `components/mines-game.tsx` | orange |
| Chicken Road | `games/chicken-road/` | `components/chicken-road-game.tsx` | sky |
| Slots | `games/slots/` | `components/slots-game.tsx` | rose |
| Roulette | `games/roulette/` | `components/roulette-game.tsx` | emerald |
| Dragon Tower | `games/dragon-tower/` | `components/dragon-tower-game.tsx` | fuchsia |
| Chicken Race | `games/chicken-race/` | `components/chicken-race-game.tsx` | slate |
| Street Cups | `games/street-cups/` | `components/street-cups-game.tsx` | stone |
| Case Battles | `games/case-battles/` | `components/case-battles-game.tsx` | cyan |
| 1P Poker | `games/poker-1p/` | `components/poker-1p-game.tsx` | green |
| HiLo | `games/hilo/` | `components/hilo-game.tsx` | purple |
| Keno | `games/keno/` | `components/keno-game.tsx` | pink |
| Coin Flip | `games/coin-flip/` | `components/coin-flip-game.tsx` | yellow |

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

Min-bets per floor live in `utils/math.ts`:
```ts
FLOOR_MIN_BETS = { 1: 20, 2: 50, 3: 100, 4: 200, 5: 500,
                   6: 1000, 7: 2000, 8: 5000, 9: 7500, 10: 10000 }
// endless floors 11+: 10000 × 1.8^(floor-10)
```

### Survival difficulty (run-wide)
Picked in `components/difficulty-dialog.tsx` at run start; stored as `difficulty` on the survival store.

**Affects two systems** (source of truth: `lib/survival/balance.ts`):

| | Normal | Hard | Nightmare |
|---|--------|------|-----------|
| Floor quota (`DIFFICULTY_QUOTA_MULT`) | 1× | 1.5× | 2.5× |
| Shop prices (`DIFFICULTY_SHOP_PRICE_MULT`) | 1× | 1.5× | 2× |

- Quota: `calcQuotaTarget(floor, difficulty)` — exponential: floors 1–10 = 2000 × 500^((f-1)/9); endless 11+ = 1M × 1.6^(f-10).
- Shop: `calcShopPrice(baseCost, difficulty)` — used in `lib/survival/shop-offers.ts` and `SurvivalShop`.
- Sparks: `calcFloorSparksEarned` in `lib/survival/sparks-economy.ts`; missions add bonus sparks via `applyMissionResults`.
- Player loop: quota met → `FloorCompleteModal` (summary → shop) → `advanceFloor` or victory `endRun`.

### Floor timer
Each floor has a **5-minute countdown** (`FLOOR_DURATION_MS = 5 * 60 * 1000`).
- `useFloorTimer()` ticks the store every second and calls `completeFloorFromTimer()` on expiry.
- `useFloorTimeRemainingMs()` computes live remaining time accounting for when it was last synced.
- The navbar shows MM:SS and a pause button while a run is active.

### Survival perks & upgrades system
Upgrades are purchased from the shop between floors using sparks.

**Reading perks in a component:**
```ts
const { hasPerk, payoutBoostMult, crashCushion, ... } = useSurvivalPerks(game)
```
The hook exposes named booleans for every known perk — prefer these over raw `hasEffect` calls.

**Payout boost:** `computePayoutMultiplier(upgrades, game)` combines run-wide and game-specific multipliers. Use `applyPayoutBoost(amount, upgrades, game)` to apply.

**Key upgrade tracks per game:** one payout boost track (5 levels: 1.05× … 1.40×) + one game-specific perk track.

**Notable per-game perks:**
- Crash: cushion (crash point floor) — levels 0.25 … 0.75
- Coin Flip: bias (heads win probability) — levels 0.58 … 0.75
- Chicken Race: scout (eliminate one losing chicken before race)
- HiLo: hot streak (keeps multiplier on incorrect guesses)
- Mines: safe tile guarantee
- Blackjack/Roulette/etc: `peekDealer` and similar one-shot advantages

**Run payout boost** (run-wide, not per game): 5 levels, 1.05× … 1.25×.
**Opening tickets** (`firstBetInsurance`): per-floor free-first-bet if opening-ticket upgrade owned.

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

## Survival store — key state shape

Beyond the basics, the survival store also tracks:

| Field | Purpose |
|---|---|
| `sparks` | Currency for shop purchases; earned by completing floors |
| `purchasedUpgrades[]` | All upgrades bought this run (`PurchasedUpgrade[]`) |
| `inventory[]` | Consumable stacks (lobby reroll tickets) |
| `missions[]` + `completedMissionIds[]` | Active/completed floor missions |
| `floorGames[]` | 6 seeded `GameName`s for the current floor |
| `quotaTarget`, `floorStartBankroll` | Floor goal and bankroll at floor start |
| `floorTimeRemainingMs`, `floorTimerPaused`, `floorTimerSyncedAt` | Timer state |
| `gamesPlayed`, `streak`, `peakBankroll` | Run-wide stats |
| `floorHistory[]` | `FloorRecord[]` — completed floor summaries |
| `firstBetInsuranceUsed` | Tracks opening-ticket free bet use |
| `shopRerollCount`, `missionRerollCount`, `lobbyRerollCount` | Escalating reroll budgets |
| `shopOfferTicketRerolls[]` | Per-slot reroll ticket tracking |
| `endlessMode` | true once the player clears all 10 floors and continues |
| `cursed`, `blessed` | Applied by dev tools or future game events |

---

## Settings store
```ts
autoReBet: boolean          // user pref — persist last bet each round
forceTie: boolean           // dev — forces HiLo to tie
showAllGames: boolean       // dev — shows all games in survival lobby
devModeUnlocked: boolean    // dev — password "geek" unlocks the panel
devTimerFrozen: boolean     // dev — freeze the floor countdown
```

---

## Dev mode (navbar)
Unlocked by entering `"geek"` in the settings panel.
- Cursed / Normal / Blessed toggle (affects crash point and other outcomes via engine flags)
- Force tie (HiLo)
- Show all games (survival lobby)
- Freeze timer
- Bankroll / Sparks numeric setters
- Grant all upgrades / Clear upgrades buttons
- Curse overlay: full-screen "YOU HAVE BEEN CURSED" message, 60s timeout

> **Gotcha:** `GRANT_ALL_UPGRADES = true` is currently set in `lib/survival/balance.ts`.
> This grants every upgrade at run start in dev mode. Set to `false` before shipping.

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

## Crash engine specifics
- Multiplier curve: `0.75 × e^(0.23t)` — starts below 1×, crosses 1× at ~1.2s, 2× at ~4.2s, 10× at ~10s
- Crash point: `Math.pow(Math.random(), 2.5)` maps to [0.8, 30]
- Cursed: always crashes at 0.8× (~280ms); Blessed: crashes at 30×

---

## Game UI rollout — all complete

All 18 games conform to `GAME_TEMPLATE.txt` sections 6–7 and `components/mines-game.tsx`.

**Per-game requirements (quick reference)**

1. `GameDockBetRow` — inline Clear beside bet (Dragon Tower style)
2. `GameActiveBetBadge` — bet + bet type top-left while round active
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
4. Add entry to `GAMES[]` in `components/lobby.tsx` (pick an unused accent color)
5. `components/<name>-game.tsx` — follow `GAME_TEMPLATE.txt` exactly
6. `app/freeplay/<name>/page.tsx` — freeplay page (see template section 2)
7. `app/survival/<name>/page.tsx` — survival page (only if `availableSurvival: true`)
