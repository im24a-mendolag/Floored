# Floored

Browser-based casino simulation. No real money, no accounts required.

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Modes

**Freeplay** — pick any available game, start with $10,000, no minimum bets, no pressure.

**Survival** — start with $1,000. Each floor has a minimum bet and 3 game slots. Clear the slots to advance; go bust and the run ends. Difficulty scales as floors climb.

## Games

| Game | Freeplay | Survival | Status |
|------|:--------:|:--------:|--------|
| Blackjack | ✓ | ✓ | Live |
| Crash | ✓ | ✓ | Live |
| Plinko | ✓ | — | Live |
| Over-Under | ✓ | — | Live |
| HiLo | | | Coming soon |
| Flipper | | | Coming soon |
| Street Cups | | | Coming soon |
| Wheel | | | Coming soon |
| Slots | | | Coming soon |
| Mines | | | Coming soon |
| Run Dice | | | Coming soon |
| Chicken Road | | | Coming soon |

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Zustand** — client-side game and run state
- **Radix UI** — accessible primitives
- **Framer Motion** — animations
- **Supabase + Prisma** — auth and persistence

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  freeplay/        # Freeplay game routes
  survival/        # Survival game routes
components/        # Game components and shared UI
games/             # Pure game engines (no React)
store/             # Zustand stores (freeplay, survival, settings)
lib/               # Utilities and static data
```
