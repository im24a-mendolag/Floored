'use client'

import { useEffect, useState } from 'react'

interface BankruptModalProps {
  onReset: () => void
}

export function BankruptModal({ onReset }: BankruptModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div
        className="relative mx-4 w-full max-w-xs rounded-2xl border border-white/10 p-8 text-center shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)' }}
      >
        <p className="text-5xl mb-4">💸</p>
        <h2 className="text-2xl font-black text-white mb-2">Bust</h2>
        <p className="text-white/40 text-sm mb-2">
          You&apos;ve run out of freeplay chips.
        </p>
        <p className="text-white/25 text-xs mb-8">
          Your bankroll will be refilled to the starting amount.
        </p>
        <button
          onClick={onReset}
          className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold rounded-xl text-sm transition-colors shadow-lg"
        >
          Refill &amp; Play Again
        </button>
      </div>
    </div>
  )
}
