'use client'

import { useRef } from 'react'

/**
 * Prevents over-committing chips when the user clicks the bet button faster
 * than React can re-render. The ref is updated synchronously, so even rapid
 * clicks within the same render cycle are correctly blocked.
 *
 * Usage:
 *   const { lock, unlock } = useBetGuard()
 *
 *   function handleStart() {
 *     if (!canStart || !lock()) return
 *     // ... place bet
 *   }
 *
 *   function handleNext() {   // or handleNewRound
 *     unlock()
 *     // ... reset to betting stage
 *   }
 */
export function useBetGuard() {
  const locked = useRef(false)

  function lock(): boolean {
    if (locked.current) return false
    locked.current = true
    return true
  }

  function unlock() {
    locked.current = false
  }

  return { lock, unlock }
}
