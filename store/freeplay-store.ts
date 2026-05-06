'use client'

import { create } from 'zustand'
import type { FreeplayStore } from './types'

export const useFreeplayStore = create<FreeplayStore>()((set) => ({
  bankroll: 10_000,
  setBankroll: (n) => set({ bankroll: n }),
  reset: () => set({ bankroll: 10_000 }),
}))
