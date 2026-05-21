'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  autoReBet: boolean
  setAutoReBet: (v: boolean) => void
  forceTie: boolean
  setForceTie: (v: boolean) => void
  showAllGames: boolean
  setShowAllGames: (v: boolean) => void
  devModeUnlocked: boolean
  setDevModeUnlocked: (v: boolean) => void
  devInfiniteBets: boolean
  setDevInfiniteBets: (v: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      autoReBet: true,
      setAutoReBet: (v) => set({ autoReBet: v }),
      forceTie: false,
      setForceTie: (v) => set({ forceTie: v }),
      showAllGames: false,
      setShowAllGames: (v) => set({ showAllGames: v }),
      devModeUnlocked: false,
      setDevModeUnlocked: (v) => set({ devModeUnlocked: v }),
      devInfiniteBets: false,
      setDevInfiniteBets: (v) => set({ devInfiniteBets: v }),
    }),
    { name: 'floored-settings' }
  )
)
