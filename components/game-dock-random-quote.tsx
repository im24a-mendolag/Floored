'use client'

import { GAMBLING_QUOTES } from '@/lib/gambling-quotes'

type GameDockRandomQuoteVariant = 'zinc' | 'ice'

const VARIANT_CLASS: Record<GameDockRandomQuoteVariant, string> = {
  zinc: 'max-w-xs mx-auto text-center text-sm italic text-zinc-600 px-2',
  ice: 'max-w-xs mx-auto text-center text-sm italic text-white/40 px-2',
}

export function GameDockRandomQuote({
  quoteIdx,
  variant = 'zinc',
}: {
  quoteIdx: number
  variant?: GameDockRandomQuoteVariant
}) {
  const text = GAMBLING_QUOTES[quoteIdx] ?? GAMBLING_QUOTES[0]
  return (
    <p className={VARIANT_CLASS[variant]}>
      &quot;{text}&quot;
    </p>
  )
}
