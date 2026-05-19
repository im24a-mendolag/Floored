# Floored — Survival Mode Master Reference

> Single reference for AI agents and developers. Covers audit, architecture, implementation order, copy-paste prompts, and remaining work.
>
> **Convention sources:** `AI_HANDSHAKE.md`, `GAME_TEMPLATE.txt`, `store/survival-store.ts`
> (`Pasted markdown.md` is not in the repo — use `AI_HANDSHAKE.md` instead.)

---

## Table of contents

1. [Objective](#objective)
2. [OUTPUT A — Existing system audit](#output-a--existing-system-audit)
3. [PHASE 2 — System design](#phase-2--system-design)
4. [PHASE 3 — Implementation order (Steps 1–18)](#phase-3--implementation-order-steps-118)
5. [PHASE 4 — Implementation rules](#phase-4--implementation-rules)
6. [Agent prompt — Step 1](#agent-prompt--step-1)
7. [Agent prompt — Steps 2 & 3](#agent-prompt--steps-2--3)
8. [What is still missing (full Survival Mode)](#what-is-still-missing-full-survival-mode)
9. [Known tech debt](#known-tech-debt)

---

## Objective

Roguelike-style **Survival Mode**:

- **10 floors**, **1,000** starting bankroll
- Per floor: **quota goal**, **6 random games**, **optional secondary missions**
- **Sparks** (meta currency): quota rewards, over-quota bonus, mission rewards; spend on run-wide upgrades, consumables, game-specific upgrades
- Integrate via **wrappers/adapters** — engines stay pure, deterministic, React-free

**Implementation order:** Audit → design → strict steps → code incrementally with validation after each step.

---

## OUTPUT A — Existing system audit

### 1. `store/survival-store.ts` today

| Field / action | Status | Notes |
|----------------|--------|--------|
| `bankroll` (1000 start) | Done | `startRun`, `deductBet`, `recordResult` / `recordResultPayout` |
| `sparks` + add/spend | Stub | Never called outside store |
| `runActive`, `startRun`, `endRun` | Done | `endRun` → `lastRun` |
| `currentFloor`, `advanceFloor` | Partial | After 3rd game resolve; **no cap at 10** |
| `slotsUsed` (3/floor) | Done | Per resolve |
| `floorMinBet` | Done | `getFloorMinBet(floor)` in `utils/math.ts` |
| `runSeed` | Stub | Set on start; **not used** for RNG until Step 3 |
| `diceConfig` | Partial | Run-wide Run Dice config |
| `jackpotMeter` | Partial | Slots survival only |
| `difficulty` | Stored | Scales **quota** (live) and **shop prices** via `balance.ts`; shop UI must use `calcShopPrice` |
| `modifiers[]` | Stub | Always `[]` |
| `history[]` | Done | `GameResult[]` per round |
| `gamesPlayed`, `streak`, `peakBankroll` | Done | |
| `lastRun` | Done | `RunSummary` component |
| Persistence | Done | Zustand `persist` → `localStorage` key `floored-survival` |

**Missing vs target:** quota/progress, 6-game pool, missions, inventory, upgrades, floor history, sparks hooks, shop, seeded floors, persist versioning.

### 2. Feature matrix

| Question | Answer |
|----------|--------|
| Bankroll | Yes — store + `hooks/use-game-bankroll.ts` |
| Floor progression | Yes — 3 games → `advanceFloor`; **not quota-based** |
| Unlocks | Lobby `availableSurvival` — **3 games only** |
| Persistence | Client localStorage; Prisma `Run` **unused** |
| Game selection | Static lobby; **no** per-floor random 6 |
| Routing | `app/survival/` + per-game pages (**12 routes**) |
| Run architecture | Flat Zustand; no floor/mission slices |
| Inventory/upgrades | Types only |
| Shop/modals | `DifficultyDialog`, `BankruptModal`; **no shop** |
| Save/load | Autosave via persist |
| Seeded selection | `utils/rng.ts` exists; unwired until Step 3 |
| Missions | **None** |

### 3. Games: lobby vs routes vs components

| Game | Lobby survival | Survival route | Component `mode` + min bet |
|------|----------------|----------------|---------------------------|
| Blackjack, Crash, Roulette | true | yes | yes |
| Plinko, Over-Under, Wheel, Run Dice, Mines, Chicken Road, Slots | false | yes | yes |
| Dragon Tower, Chicken Race, Street Cups, Case Battles, Poker-1P, HiLo, Keno, Coin Flip | false | no route | components support survival props |

### 4. Survival vs freeplay pages

- **Freeplay:** `useFreeplayGameBankroll`, bust modal, 10k chips
- **Survival:** `runActive` guard → `/survival`, `useSurvivalGameBankroll`, floor header, no bust modal, `endRun` at bankroll ≤ 0
- **Legacy:** `app/survival/dice/page.tsx` — custom `recordResult`, stale bankroll, wrong `game: 'wheel'`
- **Hub:** `app/survival/page.tsx` — `FloorPanel` + lobby when active; `RunSummary` when done
- **Entry:** Step 1 enables home + navbar; `DifficultyDialog` → `startRun` → `/survival`

### 5. Architecture snapshot

**Stores:** `survival-store` (persist), `freeplay-store`, `settings-store` (autoReBet)

**Resolve flow:**

```
Game onBet → deductBet
Game onResolve → recordResultPayout → slotsUsed++
  if slotsUsed >= 2 before increment → advanceFloor
  if bankroll <= 0 → endRun
```

**Extension points:** extend `useSurvivalGameBankroll`, `lib/survival/*`, `FloorPanel`, filter `Lobby` by `floorGames`, middleware for modifiers.

### 6. Reusable systems

| System | Path |
|--------|------|
| Run store | `store/survival-store.ts` |
| Bankroll hook | `hooks/use-game-bankroll.ts` |
| Floor min bets | `utils/math.ts` |
| Seeded RNG | `utils/rng.ts` |
| Lobby | `components/lobby.tsx` |
| Floor UI | `components/floor-panel.tsx` |
| Run end | `components/run-summary.tsx` |
| Difficulty | `components/difficulty-dialog.tsx` |
| Game layout | `components/game-layout.ts`, `game-dock-parts.tsx` |

### 7. Technical risks

- Store coupling inside `*-game.tsx` (`floorMinBet`, jackpot)
- Lobby vs routes mismatch
- 3-slot model vs future quota model
- Full persist without version (fix Step 2)
- Infinite floors until Step 14
- `addSparks` unused

---

## PHASE 2 — System design

### 1. Run state — hybrid Zustand + localStorage

```ts
interface SurvivalRun {
  version: 1
  runActive: boolean
  runSeed: string
  difficulty: Difficulty
  currentFloor: number          // 1..10
  bankroll: number              // start 1000
  sparks: number
  quotaTarget: number
  quotaProgress: number         // net profit this floor (recommended)
  floorGames: GameName[]        // length 6
  missions: FloorMission[]
  completedMissionIds: string[]
  purchasedUpgrades: PurchasedUpgrade[]
  inventory: ConsumableStack[]
  floorHistory: FloorRecord[]
  modifiers: ActiveModifier[]
  stats: RunStats
  slotsUsed: number             // legacy; reconcile in Step 5–6
  // keep: diceConfig, jackpotMeter, history, gamesPlayed, streak, peakBankroll, lastRun
}
```

**Why hybrid:** Zustand for UI; localStorage for offline/crash recovery (existing pattern); server (Prisma) later for leaderboard only.

### 2. Floor generation

**When:** `startRun` (floor 1), each `advanceFloor` after floor complete.

**Inputs:** `runSeed`, `floor`, `difficulty`, survival-eligible `GameName[]` pool.

**Outputs:** `quotaTarget`, `floorGames[6]` (unique), `missions[0-2]`, `rewardScaling`.

**RNG:** `createRng(seedFromString(\`${runSeed}:floor:${floor}\`))` → shuffle → slice(6).

**Quota:** `calcQuotaTarget(floor, difficulty)` in `lib/survival/balance.ts` — base bankroll goal per floor × difficulty quota multiplier.

**Files:** `lib/survival/floor-generator.ts`, `lib/survival/balance.ts`.

### 2b. Difficulty (quota + shop)

Chosen at run start in `components/difficulty-dialog.tsx`. Stored on the run as `difficulty` and applied for the **entire run**.

| Difficulty | Quota multiplier | Shop price multiplier |
|------------|------------------|------------------------|
| Normal | 1× | 1× |
| Hard | 1.5× | 1.5× |
| Nightmare | 2.5× | 2× |

**Quota:** `calcQuotaTarget(floor, difficulty)` uses `DIFFICULTY_QUOTA_MULT` — higher difficulty = higher bankroll target each floor (already live).

**Shop:** `calcShopPrice(baseCost, difficulty)` uses `DIFFICULTY_SHOP_PRICE_MULT` — harder runs pay more sparks per upgrade. Shop UI must call `calcShopPrice`; do not hardcode prices in components.

**Source of truth:** `lib/survival/balance.ts` (`DIFFICULTY_QUOTA_MULT`, `DIFFICULTY_SHOP_PRICE_MULT`).

### 3. Sparks economy

| Event | Formula (tunable) |
|-------|-------------------|
| Quota met | `8 + 2 * floor` |
| Over-quota | `base * min(2, (progress - target) / target)` |
| Mission | `MISSION_REWARD[type] * (1 + 0.1 * floor)` |
| Difficulty (sparks earn, optional) | Tune separately from quota/shop — see balance.ts when implemented |

Anti-snowball: shop catalog base costs × `DIFFICULTY_SHOP_PRICE_MULT` × optional owned-upgrade scaling.

### 4. Upgrade system

| Type | Apply via |
|------|-----------|
| Run-wide | `lib/survival/apply-modifiers.ts` post-resolve |
| Game-specific | hook adjusts payout/minBet for that `GameName` |
| Consumables | inventory decrement; one-shot before round |

**Catalog:** `lib/survival/upgrades-catalog.ts` — engines unchanged.

### 5. Mission system

Types: win streak, profit target, play game X, multiplier ≥ M, no-loss floor, min-bet challenge.

**Track:** `lib/survival/mission-evaluator.ts` on `SurvivalResolveEvent` from extended `useSurvivalGameBankroll`.

### 6. Floor completion

| State | Trigger |
|-------|---------|
| In progress | `quotaProgress < quotaTarget` && bankroll > 0 |
| Floor success | quota met → modal → shop (later) → next floor |
| Run fail | bankroll ≤ 0 |
| Run win | floor 10 quota cleared |

Retire or demote **3-slot** rule in favor of quota (Steps 5–6).

### 7. Shop

Between-floor Radix dialog; offers from catalog; reroll for sparks; rarity from seeded roll.

Reuse: lobby card styling, `formatChips`, UI `Card`/`Button`.

### 8. Game integration layer

```ts
interface SurvivalResolveEvent {
  game: GameName
  floor: number
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | 'push'
  multiplier?: number
  netProfit: number
}
```

All survival pages use `useSurvivalGameBankroll`; prefer passing `minBet` from page over `useSurvivalStore` in components (Step 15).

### 9. Balancing

Floors 1–3 forgiving; 8–10 tight; config in `lib/survival/balance.ts`.

### 10. Persistence

- Autosave: Zustand persist
- `version` + `lib/survival/migrate.ts`
- `abandonRun` / `partialize` (Step 17)
- Optional Prisma sync on `endRun` (Step 18)

---

## PHASE 3 — Implementation order (Steps 1–18)

### STEP 1 — Unblock entry UX

- **Goal:** Start survival from home/navbar
- **Files:** `components/mode-select.tsx`, `components/navbar.tsx`, `app/page.tsx` (if needed), `components/difficulty-dialog.tsx` (minimal)
- **Tasks:** Enable Survival; mount `DifficultyDialog`; `runActive` → continue to `/survival`, else pick difficulty
- **Validation:** New run → `/survival` + persist; freeplay unchanged

### STEP 2 — Run state schema + migration

- **Goal:** Versioned persist with quota, floorGames, stubs
- **Files:** `store/types.ts`, `store/survival-store.ts`, `lib/survival/types.ts`, `lib/survival/migrate.ts`
- **Validation:** Fresh run has v1 fields; old saves migrate

### STEP 3 — Floor generator (pure)

- **Goal:** Seeded quota + 6 games + mission stubs
- **Files:** `lib/survival/floor-generator.ts`, `lib/survival/balance.ts`, wire in store `startRun` / `advanceFloor`
- **Validation:** Same seed+floor → same games; advance regenerates

### STEP 4 — Lobby floor filter

- **Files:** `components/lobby.tsx`, `app/survival/page.tsx`
- **Tasks:** Only `floorGames` playable
- **Validation:** 6 tiles active

### STEP 5 — Quota on resolve

- **Files:** `hooks/use-game-bankroll.ts`, `store/survival-store.ts`, `components/floor-panel.tsx`
- **Tasks:** Update `quotaProgress` (net profit); progress UI
- **Validation:** Playing increases progress

### STEP 6 — Floor complete modal

- **Files:** `components/survival/floor-complete-modal.tsx`, store, hook
- **Tasks:** Quota met → modal → advance + regenerate
- **Validation:** Floor 2 after success

### STEP 7 — Sparks earning

- **Files:** `lib/survival/sparks-economy.ts`, store, modal, `FloorPanel`
- **Validation:** Sparks increase on floor complete

### STEP 8 — Missions

- **Files:** `lib/survival/missions.ts`, `mission-evaluator.ts`, `mission-panel.tsx`, hook
- **Validation:** Mission completion grants sparks

### STEP 9 — Upgrade catalog

- **Files:** `lib/survival/upgrades-catalog.ts`, `store/types.ts`
- **Validation:** Types + static data load

### STEP 10 — Shop UI

- **Files:** `components/survival/survival-shop.tsx`, modal, store
- **Validation:** Purchase spends sparks

### STEP 11 — Modifier middleware

- **Files:** `lib/survival/apply-modifiers.ts`, hook
- **Validation:** One run-wide + one game upgrade works

### STEP 12 — Unify survival pages

- **Files:** all `app/survival/**/page.tsx`; fix/remove `dice/page.tsx`
- **Validation:** All use `useSurvivalGameBankroll`

### STEP 13 — Full game pool

- **Files:** `lobby.tsx`, missing survival routes
- **Validation:** Each floor game has route

### STEP 14 — 10-floor cap + victory

- **Files:** store, `balance.ts`, `run-summary.tsx`
- **Validation:** Floor 10 win; no floor 11

### STEP 15 — Decouple games from store

- **Files:** game components + pages pass `minBet`
- **Validation:** Freeplay works without survival import

### STEP 16 — Navbar survival HUD

- **Files:** `components/navbar.tsx`
- **Validation:** Bankroll/sparks/floor on `/survival/*`

### STEP 17 — Persist hardening

- **Files:** store, `migrate.ts`
- **Validation:** Version bump migrates once

### STEP 18 — Optional server sync

- **Files:** API + Prisma
- **Validation:** Run row on end (when env configured)

---

## PHASE 4 — Implementation rules

1. **Never rewrite entire systems** — extend store/hooks
2. **Engine purity** — no survival state in `games/*/engine.ts`
3. **Wrappers/adapters** — resolve hooks, middleware, pages
4. **UI stability** — `GAME_TEMPLATE.txt` layout rules mandatory
5. **Validate incrementally** — tsc/build + one game playtest per step
6. **No giant multi-system PRs** — one step per pass
7. **Do not commit** unless user asks

---

## Agent prompt — Step 1

Copy from **STEP 1** section above, or use this checklist:

```
SCOPE: Step 1 only.

FILES: mode-select.tsx, navbar.tsx, app/page.tsx (minimal), difficulty-dialog.tsx (minimal)

mode-select.tsx:
- 'use client'
- runActive → router.push('/survival')
- else → DifficultyDialog open
- Enable Survival card (match Freeplay styling, amber theme)
- Fix invalid JSX (use div not motion)
- CTA: runActive ? 'Continue run' : 'Play now'

navbar.tsx:
- runActive → Link /survival, active when pathname starts with /survival
- !runActive → button opens DifficultyDialog
- Desktop + mobile
- Do not add bankroll HUD (Step 16)

VALIDATION:
- Home → Survival → difficulty → /survival runActive
- Refresh persists
- Continue run skips dialog
- Freeplay unchanged

DO NOT: store schema, quota, shop, missions, Step 2+
```

---

## Agent prompt — Steps 2 & 3

```
SCOPE: Steps 2 and 3 only. Step 1 must be done.

STEP 2 — store/types.ts, survival-store.ts, lib/survival/types.ts, lib/survival/migrate.ts
Add: version, quotaTarget, quotaProgress, floorGames[6], missions[], completedMissionIds[],
purchasedUpgrades[], inventory[], floorHistory[], keep legacy fields.
persist migrate v0→v1. startRun initializes. advanceFloor resets quotaProgress + regenerates floor.

STEP 3 — lib/survival/floor-generator.ts, lib/survival/balance.ts
Pure generateFloor({ runSeed, floor, difficulty, pool }) → quota, 6 unique games, mission stubs.
RNG: seedFromString(`${runSeed}:floor:${floor}`). Wire startRun + advanceFloor.

DO NOT: lobby filter (4), quota on resolve (5), modal (6), sparks (7), shop, change all lobby flags.

VALIDATION:
- v1 fields on fresh run
- old localStorage migrates
- same seed+floor → same games
- advanceFloor new games + quotaProgress 0
- Step 1 + freeplay still work
```

---

## What is still missing (full Survival Mode)

### After Step 1 only
Everything except entry UX.

### After Steps 2–3
Foundation only (~15%): versioned state + seeded floor data. **Not playable as roguelike loop yet** — no quota tracking on play, no filtered lobby, no floor complete, no sparks/shop/missions.

### Full mode checklist

| Area | Missing until |
|------|----------------|
| 6-game lobby per floor | Step 4 |
| Quota progress when playing | Step 5 |
| Floor success/fail flow | Step 6 |
| Sparks earn | Step 7 |
| Missions | Step 8 |
| Upgrade definitions | Step 9 |
| Shop | Step 10 |
| Modifiers affect gameplay | Step 11 |
| All survival pages consistent | Step 12 |
| All games in pool + routes | Step 13 |
| 10-floor win | Step 14 |
| Clean game/store separation | Step 15 |
| Survival navbar HUD | Step 16 |
| Persist hardening | Step 17 |
| Leaderboard DB | Step 18 |

### Progress map

```
Steps 1–3   → foundation (~15%)
Steps 4–7   → playable quota loop (~40%)
Steps 8–11  → roguelike meta (~70%)
Steps 12–18 → shippable polish (~100%)
```

---

## Known tech debt

1. `components/mode-select.tsx` — may have partial/broken edit (`<motion>` tags); fix in Step 1
2. Lobby `availableSurvival` vs 12 survival routes
3. `app/survival/dice/page.tsx` — legacy, wrong game id
4. `addSparks` / `modifiers` unused until Steps 7–11
5. `advanceFloor` on 3rd slot vs quota — reconcile Steps 5–6
6. No `MAX_FLOORS` enforcement until Step 14
7. `DifficultyDialog` copy promises shop/edge not implemented
8. Prisma `Run` model unused
9. Many `*-game.tsx` import `useSurvivalStore` directly

---

## Key file paths (quick reference)

```
store/survival-store.ts
store/types.ts
hooks/use-game-bankroll.ts
utils/math.ts          # getFloorMinBet floors 1-10
utils/rng.ts
components/mode-select.tsx
components/navbar.tsx
components/difficulty-dialog.tsx
components/lobby.tsx
components/floor-panel.tsx
components/run-summary.tsx
app/survival/page.tsx
app/survival/<game>/page.tsx
lib/survival/          # create in Steps 2-3+
games/<name>/engine.ts # never add survival state here
AI_HANDSHAKE.md
GAME_TEMPLATE.txt
```

---

## Resolve hook reference (current)

```ts
// hooks/use-game-bankroll.ts — extend in Steps 5+
recordResultPayout({ id, game, floor, betAmount, payout, outcome, multiplier, playedAt })
if (slotsUsed >= 2) advanceFloor()  // replace with quota check in Step 6
if (bankroll <= 0) endRun()
```

## Difficulty dialog reference

```ts
startRun(difficulty)
onClose()
router.push('/survival')
```

## Survival hub guard

```ts
// app/survival/page.tsx
if (!runActive && !lastRun) router.replace('/')
```

---

*End of master reference. Update this file when steps are completed.*
