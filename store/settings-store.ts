'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  autoReBet: boolean
  setAutoReBet: (v: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      autoReBet: true,
      setAutoReBet: (v) => set({ autoReBet: v }),
    }),
    { name: 'floored-settings' }
  )
)
