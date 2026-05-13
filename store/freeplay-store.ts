'use client'

import { create } from 'zustand'
import type { FreeplayStore } from './types'

export const useFreeplayStore = create<FreeplayStore>()((set) => ({
  bankroll: 10_000,
  setBankroll: (n) => set({ bankroll: n }),
  bust: false,
  markBust: () => set({ bust: true }),
  reset: () => set({ bankroll: 10_000, bust: false }),
}))
