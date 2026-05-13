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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
        <h2 className="text-2xl font-black text-foreground mb-2">Bust</h2>
        <p className="text-zinc-500 text-sm mb-2">
          You&apos;ve run out of freeplay chips.
        </p>
        <p className="text-zinc-700 text-xs mb-8">
          Your bankroll will be refilled to the starting amount.
        </p>
        <button
          onClick={onReset}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-lg"
        >
          Refill &amp; Play Again
        </button>
      </div>
    </div>
  )
}
