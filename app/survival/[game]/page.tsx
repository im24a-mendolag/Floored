'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { SurvivalGameWrapper } from '@/components/survival/survival-game-wrapper'
import { useSurvivalGameBankroll } from '@/hooks/use-game-bankroll'
import type { GameName } from '@/store/types'

export default function SurvivalGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const { wagerCap, handleBet, handleResolve } = useSurvivalGameBankroll(game as GameName)

  const GameComponent = GAME_REGISTRY[game as GameName]
  if (!GameComponent) notFound()

  return (
    <SurvivalGameWrapper currentGame={game as GameName}>
      <GameComponent mode="survival" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
    </SurvivalGameWrapper>
  )
}
