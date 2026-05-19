# Floored — Build Complete Survival Mode (One-Shot Agent Prompt)

> **Copy everything below the line into your AI agent.**  
> This prompt is grounded in the **current repo state** (scan before coding).  
> Also read: `AI_HANDSHAKE.md`, `GAME_TEMPLATE.txt`, `lib/survival/balance.ts`

---

## MISSION

Finish Survival Mode so it matches the product spec: **10-floor roguelike run**, **1,000 starting chips**, **6 random games per floor**, **bankroll quota per floor**, **Sparks meta-currency**, **missions**, **between-floor shop** (upgrades/consumables), **difficulty** scaling quota + shop prices, **win/lose/abandon** flows.

**Extend what exists. Do not rewrite working systems.**  
**Engines (`games/*/engine.ts`) stay pure** — no React, no Zustand.

---

## CURRENT STATE — What is already built (~65%)

### ✅ Done — do not rebuild

| Area | Implementation |
|------|----------------|
| **Entry** | `mode-select.tsx`, `navbar.tsx`, `DifficultyDialog` → `startRun` → `/survival` |
| **Difficulty** | `DIFFICULTY_QUOTA_MULT` (1 / 1.5 / 2.5×), `DIFFICULTY_SHOP_PRICE_MULT` (1 / 1.5 / 2×), `calcQuotaTarget`, `calcShopPrice` in `lib/survival/balance.ts`; copy in `difficulty-dialog.tsx` |
| **Run store v1** | `store/survival-store.ts` — persist `floored-survival`, migrate v0→v1 |
| **Floor generator** | `lib/survival/floor-generator.ts` — seeded 6 games, `SURVIVAL_GAME_POOL` (17 games) |
| **Lobby filter** | `lobby.tsx` — survival tiles = `floorGames.includes(name)` only |
| **Quota model** | **Absolute bankroll goal** per floor: `quotaTarget` from generator; progress = `bankroll - floorStartBankroll` vs `quotaTarget - floorStartBankroll`; complete when `bankroll >= quotaTarget` (`recordResultPayout`) |
| **Floor UI** | `floor-panel.tsx` — floor / bankroll / quota bar / sparks / **Abandon run** + confirm |
| **Floor complete** | `floor-complete-modal.tsx` — sparks calc, `addSparks`, `advanceFloor` or victory `endRun` |
| **Abandon** | `abandonRun()` in store + UI |
| **All survival routes** | 17 games under `app/survival/<game>/page.tsx` using `SurvivalGameWrapper` + `useSurvivalGameBankroll` |
| **Game shell** | `components/survival/survival-game-wrapper.tsx` — side stats, switch-game links; placeholder side columns |
| **Hub placeholders** | `app/survival/page.tsx` — dashed Shop + Missions “Coming soon” boxes |
| **Bankroll hook** | `hooks/use-game-bankroll.ts` — deduct bet, record payout, bust → `endRun` |

### ❌ Missing — you must build

| Area | Gap |
|------|-----|
| **Shop** | No `survival-shop.tsx`; `spendSparks` never called; `calcShopPrice` unused; hub/wrapper placeholders only |
| **Floor flow** | Floor complete → **skips shop** → advances immediately; no `floorHistory` append |
| **Missions** | `generateFloor` returns `missions: []`; no evaluator, no UI, no spark rewards |
| **Upgrades** | `purchasedUpgrades` / `inventory` / `modifiers` unused; no catalog; no `apply-modifiers` middleware |
| **Hook integration** | `useSurvivalGameBankroll` does not run missions or modifier pipeline |
| **Sparks economy** | Logic duplicated in modal; no shared `sparks-economy.ts`; difficulty not applied to spark **earnings** (optional) |
| **Run end UX** | `RunSummary` no victory vs defeat; no bust modal on survival; `lastRun.victory` missing |
| **Floor cap** | `advanceFloor` can go past floor 10; victory only checked in modal when `currentFloor >= 10` |
| **Navbar HUD** | No bankroll/sparks/floor in navbar during survival (wrapper has it on lg+ only) |
| **Cleanup** | `slotsUsed` still incremented (legacy); remove or stop using |
| **Persist** | No `partialize`; no v2 migration if schema grows |
| **Server** | Prisma `Run` unused (optional, skip unless trivial) |

---

## CORE DESIGN (follow existing code)

### Quota (already live — do not change semantics without reason)

```ts
// Per floor:
floorStartBankroll  // set at startRun / advanceFloor to current bankroll
quotaTarget         // absolute bankroll to reach (calcQuotaTarget × difficulty)
// Complete when: bankroll >= quotaTarget
// UI progress: (bankroll - floorStartBankroll) / (quotaTarget - floorStartBankroll)
```

### Difficulty (source of truth: `lib/survival/balance.ts`)

| Difficulty | Quota mult | Shop price mult |
|------------|------------|-----------------|
| normal | 1× | 1× |
| hard | 1.5× | 1.5× |
| nightmare | 2.5× | 2× |

- Quota: `calcQuotaTarget(floor, difficulty)` ✅  
- Shop: **must** use `calcShopPrice(catalogBase, difficulty)` everywhere  

### Intended player loop

```
Home → pick difficulty → /survival hub
  → pick 1 of 6 floor games → play rounds
  → bankroll >= quotaTarget → Floor Complete modal (sparks summary)
  → SHOP (spend sparks, buy upgrades/consumables)
  → Next floor (new 6 games, new quota, floorStartBankroll = bankroll)
  → repeat until floor 10 cleared (victory) OR bankroll <= 0 (defeat) OR abandon
```

---

## IMPLEMENTATION PLAN (complete all sections)

### A. Sparks economy module

**Create `lib/survival/sparks-economy.ts`**

- Move spark earn logic from `floor-complete-modal.tsx`
- `calcFloorSparksEarned({ floor, bankroll, floorStartBankroll, quotaTarget, difficulty })`
- Use `sparkFloorMult(floor)`; optional over-quota bonus (bankroll above `quotaTarget`)
- Export for modal + mission rewards

### B. Missions

**Create:**

- `lib/survival/missions.ts` — mission type defs + `generateMissionsForFloor(runSeed, floor, difficulty)` (1–2 per floor, seeded)
- `lib/survival/mission-evaluator.ts` — pure `(mission, event) => updated mission`

**Mission types (implement at least 5):**

| type | Example target |
|------|----------------|
| `win_streak` | 3 wins in a row |
| `play_game` | Play `blackjack` once |
| `reach_bankroll` | Hit +$500 net this floor |
| `min_multiplier` | Win with 2×+ |
| `games_played` | Play 4 games this floor |
| `no_bust` | End floor with bankroll > floorStart |

**Wire `lib/survival/floor-generator.ts`** — call mission generator (replace `missions: []`).

**Wire `hooks/use-game-bankroll.ts`:**

After `recordResultPayout`, build event `{ game, floor, betAmount, payout, outcome, multiplier, bankroll, floorStartBankroll }`, evaluate missions, update store (`missions`, `completedMissionIds`, `addSparks` on complete).

**UI:**

- `components/survival/mission-panel.tsx` — list missions + progress
- Replace hub placeholder + `survival-game-wrapper` left column “Missions” stub with real panel (or compact list)

### C. Upgrade catalog + shop

**Create `lib/survival/upgrades-catalog.ts`**

At least **8 items**:

- 3 **run-wide** (e.g. `payout_boost_5` — +5% payout on all wins)
- 3 **game-specific** (e.g. `blackjack_insurance` — scope `blackjack`)
- 2 **consumables** (e.g. `reroll_floor_game` — reroll one lobby slot once)

Each: `id`, `name`, `description`, `baseCost` (sparks), `scope: 'run' | 'game' | 'consumable'`, `game?`, `effectKey`, `rarity?`

**Create `lib/survival/shop-offers.ts`**

- `generateShopOffers({ runSeed, floor, difficulty, count })` — seeded pick from catalog
- Price = `calcShopPrice(item.baseCost, difficulty)`

**Store actions (`survival-store.ts`):**

```ts
purchaseUpgrade: (id: string) => void  // spendSparks, push purchasedUpgrades or inventory
```

**Create `components/survival/survival-shop.tsx`**

- Grid of offers, show spark price (after difficulty), owned state
- Purchase button disabled if `sparks < price`
- Optional: reroll offers for flat spark cost

**Replace** dashed Shop placeholder on `app/survival/page.tsx` with `<SurvivalShop />` when `!floorComplete` OR show shop inside floor-complete flow (preferred below).

### D. Modifier middleware (engine purity)

**Create `lib/survival/apply-modifiers.ts`**

```ts
applyResolveModifiers(
  payload: GameResolvePayload & { game: GameName },
  state: { purchasedUpgrades, inventory, difficulty }
): { payout: number; /* side effects */ }
```

Implement **at least 3 effect keys** from catalog, e.g.:

- `payout_mult_1.05` — multiply win payout
- `min_bet_floor_discount` — not in engine; could pass adjusted minBet from page later
- `consumable_reroll` — consumed outside resolve

**Wire `useSurvivalGameBankroll`:**

```ts
const adjusted = applyResolveModifiers(result, getState())
recordResultPayout({ ...result, payout: adjusted.payout })
// then mission evaluation
```

### E. Floor completion + shop flow (critical)

**Refactor `components/survival/floor-complete-modal.tsx`**

Two-step (or stacked) flow:

1. **Step 1 — Floor complete:** sparks earned breakdown, mission completions listed, button **“Visit shop”**
2. **Step 2 — Shop:** embed `<SurvivalShop />` or open as inner view; button **“Continue to floor N+1”** only when player dismisses shop (allow skip if sparks = 0 and nothing affordable)

On continue:

- `addSparks` (if not already on step 1)
- Append `floorHistory` record
- If `currentFloor >= MAX_FLOORS` → `endRun({ victory: true })` else `advanceFloor()`
- `dismissFloorComplete()`

**Cap floors in `advanceFloor`:**

```ts
if (s.currentFloor >= MAX_FLOORS) return s // no-op
```

### F. Run end + summary

**`store/types.ts` + `endRun`:**

```ts
lastRun: { ..., victory?: boolean, sparksEarned, difficulty, floorsReached }
```

- Victory: cleared floor 10 quota  
- Defeat: `bankroll <= 0`  
- Abandon: no `lastRun` (already correct)

**`components/run-summary.tsx`**

- Headline: Victory / Defeated / Run over  
- Show sparks, peak bankroll, difficulty, floors  

**Optional `components/survival/bust-modal.tsx`**

- On `endRun` from bust, show once before summary (or inline in summary)

### G. UI integration

**`app/survival/page.tsx`**

- Remove “Coming soon” placeholders when shop/missions are real
- Show `MissionPanel` + shop accessible between floors (or only via modal — pick one UX, prefer modal shop after floor complete + hub shop preview optional)

**`components/survival/survival-game-wrapper.tsx`**

- Replace left column placeholders with compact `MissionPanel` + owned upgrades list
- Keep game center column untouched

**`components/navbar.tsx`**

- When `runActive`: show chips `formatChips(bankroll)` + `✦ {sparks}` + `F{currentFloor}/10` (compact, amber accent)

**`components/floor-panel.tsx`**

- Ensure quota bar matches absolute-bankroll model (already does)
- Keep Abandon

### H. Cleanup + hardening

- Stop incrementing `slotsUsed` OR remove field from UI/docs (quota is the only floor limiter)
- `persist.partialize` — only run fields
- Bump `version: 2` + extend `lib/survival/migrate.ts` if you add fields
- Update `AI_HANDSHAKE.md` survival inventory table (all 17 games ✓)

### I. Out of scope (do not build unless asked)

- Prisma / leaderboard API  
- Auth / accounts  
- Rewriting game components layout  
- Changing freeplay  

---

## FILES REFERENCE

### Create

```
lib/survival/sparks-economy.ts
lib/survival/missions.ts
lib/survival/mission-evaluator.ts
lib/survival/upgrades-catalog.ts
lib/survival/shop-offers.ts
lib/survival/apply-modifiers.ts
components/survival/survival-shop.tsx
components/survival/mission-panel.tsx
components/survival/bust-modal.tsx          (optional)
```

### Modify

```
store/survival-store.ts
store/types.ts
hooks/use-game-bankroll.ts
lib/survival/floor-generator.ts
components/survival/floor-complete-modal.tsx
components/survival/survival-game-wrapper.tsx
app/survival/page.tsx
components/floor-panel.tsx
components/navbar.tsx
components/run-summary.tsx
components/difficulty-dialog.tsx          (only if copy drift)
AI_HANDSHAKE.md
```

### Do not modify

```
games/*/engine.ts        (except types if needed)
GAME_TEMPLATE layouts inside *-game.tsx
```

---

## RULES

1. **Single source of truth** for difficulty pricing: `calcShopPrice`  
2. **Single source** for quota: `calcQuotaTarget`  
3. **Pages own bankroll** — games only `onBet` / `onResolve`  
4. **SurvivalGameWrapper** pattern for all survival game routes (already standard)  
5. `pnpm exec tsc --noEmit` or `pnpm build` must pass  
6. Do not commit unless user asks  

---

## VALIDATION CHECKLIST

### Run lifecycle
- [ ] New run: difficulty → floor 1, 6 games, quota = $2k (normal), bankroll $1k  
- [ ] Play until bankroll ≥ quota → floor complete modal → shop → next floor  
- [ ] Floor 10 complete → victory summary  
- [ ] Bankroll hits 0 → defeat summary  
- [ ] Abandon → home, no stale run  

### Economy
- [ ] Sparks earned on floor complete; missions grant bonus  
- [ ] Shop prices higher on hard/nightmare (`calcShopPrice`)  
- [ ] Purchase deducts sparks; upgrade affects next resolves (`apply-modifiers`)  

### Games
- [ ] Any of 6 floor games playable; switch-game links work  
- [ ] Freeplay unchanged  

### Persist
- [ ] Refresh mid-run keeps shop purchases, missions, floor  

---

## DELIVERABLE

Reply with:

1. **Summary** of built systems  
2. **File list** (created / modified)  
3. **Player loop** confirmation (1 paragraph)  
4. **Validation** checklist marked pass/fail  
5. **Known limitations** / tuning notes  

**This completes Survival Mode MVP.**

---

## APPENDIX — Key code references

### Quota complete (store)

```ts
// recordResultPayout — bankroll >= quotaTarget sets floorComplete
const quotaJustMet = !s.floorComplete && newBankroll >= s.quotaTarget
```

### Survival page pattern

```tsx
<SurvivalGameWrapper currentGame="blackjack">
  <BlackjackGame mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
</SurvivalGameWrapper>
```

### Difficulty shop pricing

```ts
import { calcShopPrice } from '@/lib/survival/balance'
const price = calcShopPrice(item.baseCost, difficulty)
```

### Floor generator seed

```ts
createRng(seedFromString(`${runSeed}:floor:${floor}`))
```
