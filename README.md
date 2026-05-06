# Floored

> A roguelike casino survival game. Start with 1,000 chips. Survive as long as you can.

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-black?style=flat-square&logo=vercel)

## What is this

Floored is a browser-based roguelike casino game. Each run starts with 1,000 chips. Every floor you survive raises the minimum bet — eventually forcing all-or-nothing plays that can save or end your run. Earn Sparks between games, spend them on upgrades and modifiers, and stack them until it all falls apart.

Eight games. Two modes. One leaderboard.

## Games

Blackjack · Crash · Plinko · HiLo · Dice · Run Dice · Mines · Chicken Road · Slots

## Modes

**Survival** — Endless floors with rising minimum bets. Run ends when you go broke. Leaderboard tracks your highest floor.

**Freeplay** — All 8 games, no floors, no economy, no pressure.

## Stack

- **Framework** — Next.js 14 (App Router)
- **Language** — TypeScript (strict)
- **Database** — Supabase (Postgres + Auth)
- **ORM** — Prisma
- **Styling** — Tailwind CSS + shadcn/ui
- **Animation** — Framer Motion + PixiJS
- **State** — Zustand
- **Hosting** — Vercel

## Getting started

```bash
git clone https://github.com/you/floored
cd floored
pnpm install
cp .env.example .env.local
pnpm dev
```

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
```

## Project status

Early development. Game design complete, build in progress.
