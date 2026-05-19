# Floored — Reset Run Button + Survival Game Unlock (Agent Prompt)

> **Scope:** Two features only. Do not implement shop, missions, quota changes, or other Survival steps.  
> **Read first:** `AI_HANDSHAKE.md`, `GAME_TEMPLATE.txt`, `store/survival-store.ts`, `lib/survival/balance.ts`, `app/survival/blackjack/page.tsx`

---

## OBJECTIVE

1. **Abandon / reset run** — Player can end the current survival run from the UI and start fresh from home.
2. **All games unlocked for survival** — Every game that works in freeplay can appear in the survival floor pool and be played when selected for that floor.

---

## FEATURE 1 — Reset / abandon run button

### Store (`store/survival-store.ts` + `store/types.ts`)

Add action:

```ts
abandonRun: () => void
```

**Behavior:**

- Set `runActive: false`
- Clear active run fields (same as a clean post-run state): `runSeed: null`, reset `floorGames: []`, `quotaProgress: 0`, `floorComplete: false`, etc.
- **Do not** populate `lastRun` (abandon is not a completed run — unlike `endRun`)
- Keep `lastRun` unchanged if it already exists from a prior finished run, OR set `lastRun: null` — prefer **`lastRun: null`** so `/survival` redirects home via existing guard
- Do **not** wipe `floored-survival` persist entirely; only clear run slice

Add to `SurvivalStore` interface in `store/types.ts`.

### UI placement

Add **“Abandon run”** (or “Reset run”) on the survival hub:

- **Primary location:** `components/floor-panel.tsx` — secondary/outline button, right side or below quota bar
- **Optional:** duplicate in account menu on `components/navbar.tsx` when `runActive` (lower priority)

**UX:**

- Click → confirm dialog (Radix `AlertDialog` or `Dialog`):  
  *“Abandon this run? Progress, sparks, and upgrades for this run will be lost.”*
- Confirm → `abandonRun()` → `router.push('/')`
- Cancel → close dialog

**Styling:** destructive variant (`text-red-400`, `border-red-900/50`) — clearly distinct from floor-complete actions.

### Do not

- Call `startRun` from abandon (user starts new run from home)
- Use `endRun` for abandon (that implies a finished run with summary)

---

## FEATURE 2 — Unlock all games for survival

### A. Expand survival game pool

**File:** `lib/survival/balance.ts`

Update `SURVIVAL_GAME_POOL` to include **every game** that has:

- `components/<name>-game.tsx` with `mode: 'survival' | 'freeplay'` props, AND
- `app/freeplay/<name>/page.tsx`

**Include (17 games):**

```
blackjack, crash, plinko, over-under, wheel, run-dice, mines, chicken-road, slots, roulette,
dragon-tower, chicken-race, street-cups, case-battles, poker-1p, hilo, keno, coin-flip
```

**Exclude:** stubs without working components (e.g. flipper if no component).

Update the file comment: pool is the source of truth for floor generation; lobby survival availability still uses `floorGames` (6 per floor).

### B. Create missing survival routes

**Template:** Copy `app/survival/blackjack/page.tsx` exactly, swap game component and `useSurvivalGameBankroll('game-name')`.

**Create only if missing:**

| Route | Component | Hook game id |
|-------|-----------|--------------|
| `app/survival/dragon-tower/page.tsx` | `DragonTowerGame` | `'dragon-tower'` |
| `app/survival/chicken-race/page.tsx` | `ChickenRaceGame` | `'chicken-race'` |
| `app/survival/street-cups/page.tsx` | `StreetCupsGame` | `'street-cups'` |
| `app/survival/case-battles/page.tsx` | `CaseBattlesGame` | `'case-battles'` |
| `app/survival/poker-1p/page.tsx` | `Poker1pGame` or actual export name | `'poker-1p'` |
| `app/survival/hilo/page.tsx` | `HiloGame` | `'hilo'` |
| `app/survival/keno/page.tsx` | `KenoGame` | `'keno'` |
| `app/survival/coin-flip/page.tsx` | `CoinFlipGame` | `'coin-flip'` |

**Each page must:**

```tsx
'use client'
// useEffect: if (!runActive) router.replace('/survival')
// useSurvivalGameBankroll('<game>')
// Header: Floor N · Min bet · (optional sparks later — no slotsUsed/3 unless already there)
// <Game mode="survival" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
```

Verify actual component export names from `components/*-game.tsx` before importing.

### C. Lobby flags (cosmetic)

**File:** `components/lobby.tsx`

Set `availableSurvival: true` for every game in `SURVIVAL_GAME_POOL`.

**Note:** Survival lobby **already** filters by `floorGames.includes(g.name)` — flags only affect copy/“coming soon” if logic still checks them anywhere. Survival `isAvailable` must remain:

```ts
return floorGames.includes(g.name)
```

Do not show all 17 games every floor — only the **6** from `floorGames`.

### D. Verify generator

**File:** `lib/survival/floor-generator.ts`

With 17 games in pool, Fisher-Yates + `slice(0, 6)` yields 6 unique games without cycling fallback.

Run quick sanity: pool.length >= 6 always.

---

## FILES TO TOUCH

| File | Action |
|------|--------|
| `store/types.ts` | Add `abandonRun` to interface |
| `store/survival-store.ts` | Implement `abandonRun` |
| `components/floor-panel.tsx` | Abandon button + confirm dialog |
| `lib/survival/balance.ts` | Expand `SURVIVAL_GAME_POOL` |
| `components/lobby.tsx` | `availableSurvival: true` for pool games |
| `app/survival/<missing>/page.tsx` | Create up to 8 pages |
| `AI_HANDSHAKE.md` | Update survival column for newly routed games (optional) |

**Do not modify:** `games/*/engine.ts`, shop, missions, `floor-complete-modal` flow (unless abandon needs no touch).

**Difficulty (reference only):** Quota and shop prices scale by difficulty — see `lib/survival/balance.ts` and `components/difficulty-dialog.tsx`. Out of scope for this prompt.

---

## RULES

1. Minimal diff — only reset + unlock scope  
2. Match existing survival page pattern (`blackjack`)  
3. `GAME_TEMPLATE.txt` layout rules apply to game components — do not refactor game UIs  
4. Run `pnpm exec tsc --noEmit` or `pnpm build` before done  
5. Do not commit unless user asks  

---

## VALIDATION

### Reset button
- [ ] Mid-run on `/survival` → Abandon → confirm → lands on `/` with no active run  
- [ ] `/survival` redirects to `/` when no `runActive` and no `lastRun`  
- [ ] Home → new run via difficulty still works  
- [ ] Finished run `lastRun` summary still works when using `endRun` (bust/victory), not conflated with abandon  

### Game unlock
- [ ] `SURVIVAL_GAME_POOL.length` === 17 (or count of live freeplay games)  
- [ ] New `app/survival/*` routes load without 404  
- [ ] When a game is in `floorGames`, lobby tile is playable → game loads, bet/resolve updates bankroll  
- [ ] Floor still shows **6** games, not 17  
- [ ] Same `runSeed` + floor → same 6 games (seeded gen unchanged)  
- [ ] Freeplay unchanged  

---

## DELIVERABLE

1. Short summary  
2. List of created/modified files  
3. Confirm which survival routes were added vs already existed  
4. Validation checklist results  

**Stop after this scope. Do not implement shop, missions, or full finish prompt.**
