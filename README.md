# Floored

Browser-based casino simulation — no real money, no accounts required.

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Freeplay (primary focus)

Freeplay is the core, ready-to-play mode: choose any game, start with a healthy balance, and play without pressure or minimum bets.

- Starting balance: $10,000
- No accounts or real-money transactions
- Instant sessions, local state persisted for convenience

### Games available in Freeplay

The project currently implements 18 games in Freeplay:

- Blackjack
- Case Battles
- Chicken Race
- Chicken Road
- Coin Flip
- Crash
- Dragon Tower
- HiLo
- Keno
- Mines
- Over-Under
- Plinko
- Poker (1-player)
- Roulette
- Run Dice
- Slots
- Street Cups
- Wheel

## Survival (coming soon)

Survival mode is planned but not the primary focus of this README. It will introduce floor-based progression, minimum bets, and run-ending failure conditions. Do you want me to include specific rules or promotional copy for Survival now? If so, tell me the target difficulty, starting bankroll, or any special mechanics to mention.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (client-side state)
- Radix UI (primitives)
- Framer Motion (animations)
- Supabase + Prisma (optional persistence)

## Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to run locally.

## Project structure

```
app/
  freeplay/        # Freeplay game routes
  survival/        # Survival game routes (planned)
components/        # React components and shared UI
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (freeplay, survival, settings)
lib/               # Utilities and static data
```
