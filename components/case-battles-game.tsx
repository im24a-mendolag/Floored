'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GameFieldWithHistory, type MatchHistoryEntry, type MatchHistoryTone } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import {
  CASES,
  addCase,
  initCaseBattle,
  removeCase,
  settleBattle,
  startBattle,
} from '@/games/case-battles/engine'
import type { CaseBattleState, CaseRarity } from '@/games/case-battles/types'

interface CaseBattlesResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface CaseBattlesGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onResolve: (result: CaseBattlesResult) => void
}

interface PendingResult {
  tone: MatchHistoryTone
  label: string
  entry: MatchHistoryEntry
}

const RARITY_TEXT: Record<CaseRarity, string> = {
  common:    'text-zinc-300',
  uncommon:  'text-green-400',
  rare:      'text-blue-400',
  epic:      'text-purple-400',
  legendary: 'text-yellow-400',
}

const RARITY_BORDER: Record<CaseRarity, string> = {
  common:    'border-zinc-600',
  uncommon:  'border-green-700',
  rare:      'border-blue-700',
  epic:      'border-purple-700',
  legendary: 'border-yellow-500',
}

// Slot rendering for opening/settled columns
function ItemSlot({
  caseEmoji, item, isRevealing, isRevealed,
}: {
  caseEmoji: string
  item: { name: string; icon: string; value: number; rarity: CaseRarity }
  isRevealing: boolean
  isRevealed: boolean
}) {
  const borderClass = isRevealing
    ? 'border-yellow-500 case-item-suspense'
    : isRevealed
      ? RARITY_BORDER[item.rarity]
      : 'border-zinc-800'

  return (
    <div className={`rounded-xl border-2 px-3 py-2.5 min-h-[4.5rem] flex items-center ${borderClass}`}>
      {isRevealed ? (
        <div key="revealed" className="flex items-center gap-3 w-full case-item-reveal">
          <span className="text-3xl leading-none shrink-0">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm leading-snug truncate ${RARITY_TEXT[item.rarity]}`}>
              {item.name}
            </p>
            <p className="text-zinc-300 font-black tabular-nums text-sm">{formatChips(item.value)}</p>
          </div>
        </div>
      ) : isRevealing ? (
        <div key="revealing" className="flex items-center justify-center w-full">
          <span className="text-4xl">❓</span>
        </div>
      ) : (
        <div key="locked" className="flex items-center justify-center w-full opacity-30">
          <span className="text-3xl">{caseEmoji}</span>
        </div>
      )}
    </div>
  )
}

export function CaseBattlesGame({ mode, bankroll, onResolve }: CaseBattlesGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [state, setState] = useState<CaseBattleState>(initCaseBattle)
  const [revealedCount, setRevealedCount] = useState(0)
  const [revealingIdx, setRevealingIdx] = useState(-1)
  const [lastSelectedCases, setLastSelectedCases] = useState<number[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const isSetup   = state.stage === 'setup'
  const isOpening = state.stage === 'opening'
  const isSettled = state.stage === 'settled'

  const canBattle = state.selectedCases.length > 0 && state.totalCost <= bankroll && state.totalCost >= minBet
  const numCases  = state.selectedCases.length

  const displayUserTotal = state.userItems.slice(0, revealedCount).reduce((s, oc) => s + oc.item.value, 0)
  const displayBotTotal  = state.botItems.slice(0, revealedCount).reduce((s, oc) => s + oc.item.value, 0)

  function clearTimeouts() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  useEffect(() => {
    if (state.stage !== 'opening') return

    setRevealedCount(0)
    setRevealingIdx(0)
    const total = state.selectedCases.length

    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        setRevealedCount(i + 1)
        if (i + 1 < total) setRevealingIdx(i + 1)
        else setRevealingIdx(-1)
      }, i * 800 + 600)
      timeoutsRef.current.push(t)
    }

    const tSettle = setTimeout(() => {
      setState(prev => {
        const settled = settleBattle(prev)
        resolveGame(settled)
        return settled
      })
    }, (total - 1) * 800 + 600 + 500)
    timeoutsRef.current.push(tSettle)

    return clearTimeouts
  }, [state.stage])

  useEffect(() => () => clearTimeouts(), [])

  function resolveGame(s: CaseBattleState) {
    const payout = s.outcome === 'win' ? s.userTotal + s.botTotal : 0
    const mult   = s.totalCost > 0 ? parseFloat(((s.userTotal + s.botTotal) / s.totalCost).toFixed(2)) : 0
    onResolve({ outcome: s.outcome!, betAmount: s.totalCost, payout, multiplier: s.outcome === 'win' ? mult : 0 })
    const net   = payout - s.totalCost
    const tone: MatchHistoryTone = s.outcome === 'win' ? 'win' : 'loss'
    const title = s.outcome === 'win' ? `+${formatChips(net)}` : `−${formatChips(s.totalCost)}`
    const label = s.outcome === 'win' ? formatChips(payout) : title
    setPendingResult({
      tone, label,
      entry: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        at: new Date(),
        title,
        subtitle: `${s.selectedCases.length} cases · ${formatChips(s.totalCost)} · ${s.outcome === 'win' ? `Won ${formatChips(payout)}` : 'Loss'}`,
        tone,
      },
    })
  }

  function handleBattle() {
    if (!canBattle) return
    setLastSelectedCases(state.selectedCases)
    clearTimeouts()
    setState(prev => startBattle(prev))
    setPendingResult(null)
  }

  const handleNext = useCallback(() => {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    const fresh = initCaseBattle()
    if (autoReBet && lastSelectedCases.length > 0) {
      const cost = lastSelectedCases.reduce((s, id) => s + (CASES[id]?.price ?? 0), 0)
      if (cost <= bankroll) {
        setState({ ...fresh, selectedCases: lastSelectedCases, totalCost: cost })
        return
      }
    }
    setState(fresh)
  }, [pendingResult, autoReBet, lastSelectedCases, bankroll])

  const caseCounts = CASES.map(c => state.selectedCases.filter(id => id === c.id).length)

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Case Battles</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-3 py-4 gap-3"
        entries={matchHistory}
        gameLabel="Case Battles"
      >
        {isSetup && (
          <button onClick={() => router.push(`/${mode}`)}
            className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
            ← Back
          </button>
        )}

        {!isSetup && state.totalCost > 0 && (
          <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatChips(state.totalCost)}</p>
          </div>
        )}

        {/* Setup phase: case selector */}
        {isSetup && (
          <div className="w-full max-w-md flex flex-col gap-4">
            <p className="text-sm text-zinc-500 text-center uppercase tracking-wider font-semibold">
              Select up to 5 cases — {numCases}/5
            </p>
            <div className="grid grid-cols-5 gap-2.5">
              {CASES.map(c => {
                const count = caseCounts[c.id] ?? 0
                const atMax = numCases >= 5 && count === 0
                return (
                  <div key={c.id} className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setState(prev => addCase(prev, c.id))}
                      disabled={numCases >= 5}
                      className={[
                        'w-full h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 active:scale-95',
                        count > 0
                          ? 'border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 shadow-lg shadow-yellow-900/20'
                          : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-800',
                        atMax ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span className="text-3xl leading-none">{c.emoji}</span>
                      {count > 0 && (
                        <span className="text-xs font-black text-yellow-400 leading-none">×{count}</span>
                      )}
                    </button>
                    <p className="text-xs text-zinc-400 text-center font-semibold leading-tight">{c.name.replace(' Case', '')}</p>
                    <p className="text-xs font-bold text-zinc-200">${c.price}</p>
                    {count > 0 ? (
                      <button
                        type="button"
                        onClick={() => setState(prev => removeCase(prev, c.id))}
                        className="w-full py-1.5 text-sm font-bold text-red-400 hover:text-white bg-red-950 hover:bg-red-700 border border-red-800 hover:border-red-600 rounded-lg transition-colors active:scale-95"
                      >
                        − Remove
                      </button>
                    ) : (
                      <span className="w-full py-1.5 text-sm invisible select-none border rounded-lg">− Remove</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Opening / settled phase: two columns */}
        {(isOpening || isSettled) && (
          <div className="w-full max-w-sm flex gap-4">
            {/* YOU column */}
            <div className="flex-1 flex flex-col gap-2">
              <p className={`text-xs uppercase tracking-widest text-center font-black ${isSettled && state.outcome === 'win' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                You {isSettled && state.outcome === 'win' ? '🏆' : ''}
              </p>
              {state.userItems.map((oc, i) => (
                <ItemSlot
                  key={i}
                  caseEmoji={CASES[oc.caseId]?.emoji ?? '📦'}
                  item={oc.item}
                  isRevealing={i === revealingIdx}
                  isRevealed={i < revealedCount}
                />
              ))}
              {(isSettled || (isOpening && revealedCount > 0)) && (
                <div className="border-t-2 border-zinc-700 pt-1.5 mt-0.5">
                  <p className={`text-sm font-black tabular-nums text-right ${isSettled && state.outcome === 'win' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {formatChips(isSettled ? state.userTotal : displayUserTotal)}
                  </p>
                </div>
              )}
            </div>

            {/* BOT column */}
            <div className="flex-1 flex flex-col gap-2">
              <p className={`text-xs uppercase tracking-widest text-center font-black ${isSettled && state.outcome === 'loss' ? 'text-red-400' : 'text-zinc-500'}`}>
                Bot {isSettled && state.outcome === 'loss' ? '🏆' : ''}
              </p>
              {state.botItems.map((oc, i) => (
                <ItemSlot
                  key={i}
                  caseEmoji={CASES[oc.caseId]?.emoji ?? '📦'}
                  item={oc.item}
                  isRevealing={i === revealingIdx}
                  isRevealed={i < revealedCount}
                />
              ))}
              {(isSettled || (isOpening && revealedCount > 0)) && (
                <div className="border-t-2 border-zinc-700 pt-1.5 mt-0.5">
                  <p className={`text-sm font-black tabular-nums text-right ${isSettled && state.outcome === 'loss' ? 'text-red-400' : 'text-zinc-300'}`}>
                    {formatChips(isSettled ? state.botTotal : displayBotTotal)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className="flex min-h-[188px] flex-col justify-between py-3">

          {/* Invisible chip strip placeholder for consistent height */}
          <div className="invisible pointer-events-none flex flex-nowrap justify-center gap-2">
            <div className="w-12 h-12 rounded-full" />
            <div className="w-12 h-12 rounded-full" />
            <div className="w-12 h-12 rounded-full" />
            <div className="w-12 h-12 rounded-full" />
            <div className="h-12 w-10 rounded-full" />
            <div className="h-12 w-14 rounded-full" />
          </div>

          {/* Info row */}
          <div className="h-10 flex items-center justify-center">
            {isSetup && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-zinc-500 text-base">Total cost</span>
                  <span className={`font-bold text-xl tabular-nums ${state.totalCost > bankroll ? 'text-red-400' : 'text-white'}`}>
                    {state.totalCost > 0 ? formatChips(state.totalCost) : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setState(initCaseBattle())}
                  className={`px-3 py-1 text-sm font-medium rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors ${numCases === 0 ? 'invisible' : ''}`}
                >
                  Clear
                </button>
              </div>
            )}
            {isOpening && (
              <p className="text-sm text-zinc-500 italic">
                Opening {Math.min(revealedCount + 1, numCases)} of {numCases}…
              </p>
            )}
            {isSettled && pendingResult && (
              <div className="flex items-center gap-3">
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {pendingResult.tone === 'win' ? 'Win' : 'No win'}
                </p>
                <p className={`text-2xl font-black tabular-nums ${pendingResult.tone === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pendingResult.label}
                </p>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={isSettled ? handleNext : handleBattle}
              disabled={isOpening || (isSetup && !canBattle)}
              className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
            >
              {isSettled ? 'Next →' : isOpening ? 'Opening…' : 'Battle →'}
            </button>
          </div>

          {minBet > 1 && isSetup && (
            <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
