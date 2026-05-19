# Floored — Finish Survival Mode (One-Shot Agent Prompt)

> Copy everything below the line into your AI agent.  
> **Read first:** `AI_HANDSHAKE.md`, `GAME_TEMPLATE.txt`, `SURVIVAL_MODE_MASTER.md`

---

## CONTEXT — Current progress (scan as of repo state)

### ✅ Already implemented (~Steps 1–7 partial, ~55%)

| Area | Status | Evidence |
|------|--------|----------|
| Entry UX | Done | `mode-select.tsx`, `navbar.tsx` + `DifficultyDialog` |
| Run schema v1 + migrate | Done | `store/survival-store.ts`, `lib/survival/migrate.ts` |
| Floor generator | Done | `lib/survival/floor-generator.ts`, `balance.ts`, `SURVIVAL_GAME_POOL` (10 games) |
| Lobby 6-game filter | Done | `lobby.tsx` uses `floorGames.includes(g.name)` |
| Quota on resolve | Done | `recordResultPayout` updates `quotaProgress` (net profit) |
| Floor panel + quota bar | Done | `components/floor-panel.tsx` |
| Floor complete modal | Done | `components/survival/floor-complete-modal.tsx` — sparks calc + `addSparks` + `advanceFloor` / victory `endRun` |
| MAX_FLOORS = 10 | Partial | Victory when `currentFloor >= 10`; **`advanceFloor` does not cap** — can exceed floor 10 |
| Bankroll hook | Done | `useSurvivalGameBankroll` — no slot-based advance (good) |
| 10 survival routes | Done | blackjack, crash, plinko, over-under, wheel, run-dice, mines, chicken-road, slots, roulette |
| Persist v1 | Done | `floored-survival` + migrate |

### ⚠️ Claimed by user but NOT found in repo (implement if missing)

- **Reset / abandon run button** — no `abandonRun`, `resetRun`, or UI in `floor-panel` / `survival/page` / navbar
- **All games unlocked** — only **10** games in `SURVIVAL_GAME_POOL`; **8** freeplay games lack `app/survival/<game>/page.tsx` (dragon-tower, chicken-race, street-cups, case-battles, poker-1p, hilo, keno, coin-flip)

### ❌ Not implemented (~Steps 8–18)

- Missions (generator returns `missions: []`)
- Shop between floors (spend sparks)
- Upgrade catalog + modifier middleware
- Difficulty affecting sparks / house edge in gameplay
- `floorHistory` append on floor complete
- Mission UI panel
- Survival navbar HUD (bankroll, sparks, floor)
- `RunSummary` victory vs defeat, sparks breakdown
- `spendSparks` never used
- `modifiers` / `purchasedUpgrades` / `inventory` unused
- `dismissFloorComplete` unused
- Legacy **slotsUsed /3 slots** still on every survival game page header
- Game components still import `useSurvivalStore` for `floorMinBet`
- Prisma leaderboard sync
- `partialize` / hardened persist / `abandonRun` action

---

## YOUR MISSION

**Complete Survival Mode end-to-end in one session.**  
Extend existing code; do not rewrite working systems.  
Engines in `games/*/engine.ts` stay **pure** (no React, no Zustand).

When done, a player can:

1. Start a run (difficulty) → 10 floors max  
2. Each floor: **6 random games**, **quota** (net profit), optional **missions**  
3. On quota met → **floor complete** → earn **sparks** → **shop** → next floor  
4. **Spend sparks** on run-wide / game / consumable upgrades that affect resolves via **hook middleware**  
5. **Win** floor 10 or **lose** on bust; see **run summary**  
6. **Reset/abandon** run anytime  
7. Play **every freeplay game** that has a component in survival (all routes + pool)

---

## IMPLEMENTATION CHECKLIST (do all)

### A. Run control

**`store/survival-store.ts` + `store/types.ts`**

- Add `abandonRun(): void` — sets `runActive: false`, clears run slice, keeps or clears `lastRun` per `endRun` pattern; user can start fresh from home
- Add `victory?: boolean` to `RunSummary`
- On `advanceFloor`: **do not** go past `MAX_FLOORS` (10)
- On floor complete (before advance): append `FloorRecord` to `floorHistory` with `quotaTarget`, `quotaAchieved`, `floorGames`, `endBankroll`, `completedAt`
- Call `dismissFloorComplete()` when closing modal after shop step

**UI — Reset run**

- `components/floor-panel.tsx` or `app/survival/page.tsx`: destructive **“Abandon run”** button (confirm dialog) → `abandonRun()` → route `/`
- If button already exists locally, ensure it calls `abandonRun` and is wired

### B. All games in survival

**`lib/survival/balance.ts`**

- Expand `SURVIVAL_GAME_POOL` to **every `GameName` that has** `components/<game>-game.tsx` + `app/freeplay/<game>/page.tsx` (17 games; exclude stubs without components)

**Create missing routes** (copy pattern from `app/survival/blackjack/page.tsx`):

- `app/survival/dragon-tower/page.tsx`
- `app/survival/chicken-race/page.tsx`
- `app/survival/street-cups/page.tsx`
- `app/survival/case-battles/page.tsx`
- `app/survival/poker-1p/page.tsx`
- `app/survival/hilo/page.tsx`
- `app/survival/keno/page.tsx`
- `app/survival/coin-flip/page.tsx`

Each: `runActive` guard, `useSurvivalGameBankroll('<game>')`, `mode="survival"`, floor header (**remove `slotsUsed/3`** — use sparks or quota only).

**`components/lobby.tsx`**

- Set all implemented games `availableSurvival: true` (cosmetic; survival availability = `floorGames` anyway)

### C. Sparks economy (complete)

**`lib/survival/sparks-economy.ts` (new)**

```ts
// calcFloorSparks(floor, quotaProgress, quotaTarget, difficulty, missionsCompleted): number
// Apply: sparkFloorMult(floor), over-quota bonus, difficulty mult (normal 1, hard 0.75, nightmare 0.5)
```

- Move spark math out of `floor-complete-modal.tsx` into this module
- Use in modal + anywhere else

### D. Missions (Step 8)

**`lib/survival/missions.ts` (new)** — define 5+ mission types:

- `win_streak`, `profit_target`, `play_game`, `min_multiplier`, `no_loss_floor`, `min_bet_each_game`

**`lib/survival/mission-evaluator.ts` (new)** — pure `(mission, event) => progress`

**`lib/survival/floor-generator.ts`** — generate 1–2 missions per floor (seeded: `${runSeed}:missions:${floor}`)

**`hooks/use-game-bankroll.ts`**

- After `recordResultPayout`, build `SurvivalResolveEvent` and run evaluator; on complete → `addSparks(mission.rewardSparks)`, push `completedMissionIds`

**`components/survival/mission-panel.tsx` (new)** — list missions + progress on survival hub

**`app/survival/page.tsx`** — render `MissionPanel` below `FloorPanel`

### E. Shop + upgrades (Steps 9–11)

**`lib/survival/upgrades-catalog.ts` (new)**

- At least 3 run-wide, 3 game-specific, 2 consumables
- Fields: `id`, `name`, `description`, `cost`, `rarity`, `scope`, `effectKey`, optional `game`

**`lib/survival/apply-modifiers.ts` (new)**

- `applyResolveModifiers(event, purchasedUpgrades, inventory): { adjustedPayout, adjustedBet?, sparksBonus? }`
- Effect keys examples: `payout_mult_1.1`, `min_bet_discount`, `free_reroll` — implement 3–4 real effects

**`store/survival-store.ts`**

- `purchaseUpgrade(id)`, `useConsumable(id)`, `spendSparks`
- Track `purchasedUpgrades`, `inventory`

**`components/survival/survival-shop.tsx` (new)**

- Seeded offers per floor (`${runSeed}:shop:${floor}`), 4–6 items from catalog
- Difficulty rules from `difficulty-dialog` copy: hard = 3 picks, nightmare = 2 picks + 2× cost
- Reroll button (cost sparks)
- Purchase → `spendSparks` + add upgrade/inventory

**Floor flow (fix `floor-complete-modal.tsx`)**

1. Quota met → modal step 1: sparks summary + **“Open shop”**
2. Shop overlay (or second step in dialog)
3. **“Continue to next floor”** → `advanceFloor()`, reset shop state, close modal
4. Floor 10 victory → shop optional → `endRun({ victory: true })`

### F. Hook middleware (integrate modifiers)

**`hooks/use-game-bankroll.ts`**

```ts
handleResolve(result) {
  const adjusted = applyResolveModifiers({ game, ...result, floor, bankroll }, store.getState())
  recordResultPayout({ ...result, payout: adjusted.payout })
  evaluateMissions(...)
  // bust check
}
```

Do **not** change engine files.

### G. Difficulty effects

**`lib/survival/balance.ts`**

- `difficultySparkMult(difficulty)`, `difficultyHouseEdgeMult(difficulty)` — use in sparks + optional payout nerf in `apply-modifiers` (nightmare/hard slightly reduce effective payout)

### H. UI polish

**`components/navbar.tsx`** — when `runActive` && `inSurvival` or any `/survival`:

- Show bankroll, sparks (✦), floor N/10

**`components/run-summary.tsx`**

- Show victory/defeat headline, total sparks, floors cleared

**Remove legacy UI**

- Delete `slotsUsed/3 slots` from all `app/survival/**/page.tsx` headers
- Optionally remove `slotsUsed` increments from store (or leave unused but stop displaying)

**Bust UX**

- On `endRun` from bankroll ≤ 0: optional `BustModal` or clear copy on `RunSummary` (“Run over”)

### I. Persist hardening

**`store/survival-store.ts`**

- `partialize` to run-relevant fields only
- Bump `version: 2` if schema changes; extend `migrate.ts`

### J. Docs

- Update `AI_HANDSHAKE.md` survival table + `SURVIVAL_MODE_MASTER.md` progress section

---

## FILES TO CREATE

```
lib/survival/sparks-economy.ts
lib/survival/missions.ts
lib/survival/mission-evaluator.ts
lib/survival/upgrades-catalog.ts
lib/survival/apply-modifiers.ts
components/survival/mission-panel.tsx
components/survival/survival-shop.tsx
app/survival/dragon-tower/page.tsx
app/survival/chicken-race/page.tsx
app/survival/street-cups/page.tsx
app/survival/case-battles/page.tsx
app/survival/poker-1p/page.tsx
app/survival/hilo/page.tsx
app/survival/keno/page.tsx
app/survival/coin-flip/page.tsx
```

## FILES TO MODIFY (primary)

```
store/survival-store.ts
store/types.ts
hooks/use-game-bankroll.ts
lib/survival/balance.ts
lib/survival/floor-generator.ts
lib/survival/migrate.ts
components/survival/floor-complete-modal.tsx
components/floor-panel.tsx
components/lobby.tsx
components/navbar.tsx
components/run-summary.tsx
app/survival/page.tsx
app/survival/**/page.tsx  (headers + verify hook)
AI_HANDSHAKE.md
```

---

## RULES (non-negotiable)

1. **Engine purity** — no survival imports in `games/*/engine.ts`
2. **GAME_TEMPLATE.txt** — survival pages use same layout; no control-dock regressions
3. **Page owns bankroll** — games use `onBet` / `onResolve` only
4. **Minimal scope creep** — no auth, no Prisma API unless trivial stub
5. **TypeScript clean** — run `pnpm exec tsc --noEmit` or `pnpm build`
6. **Do not commit** unless user asks

---

## VALIDATION (all must pass)

- [ ] Home → Survival → difficulty → `/survival` with 6 games in lobby
- [ ] Play games until quota met → floor complete → sparks awarded → shop opens → buy upgrade → next floor with new 6 games
- [ ] Mission completes during floor → bonus sparks
- [ ] Bankroll 0 → run ends → summary
- [ ] Floor 10 quota → victory summary
- [ ] Abandon run → home, can start new run
- [ ] All 17 games reachable when they appear in `floorGames` (direct URL works)
- [ ] Refresh mid-run preserves state
- [ ] Freeplay unchanged

---

## DELIVERABLE

Reply with:

1. Summary of what was built  
2. File list (created/modified)  
3. Any formulas (quota/sparks) if tuned  
4. Known limitations / follow-ups  
5. Validation checklist results  

**This completes Survival Mode MVP.**
