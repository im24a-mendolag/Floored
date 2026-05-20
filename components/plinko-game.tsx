'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import {
  GAME_DOCK_INNER,
  GameCurrentBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
} from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, formatPlinkoRiskLabel } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { pickQuote } from '@/lib/gambling-quotes'
import { computePayout, generatePath, loseGamePath, winGamePath } from '@/games/plinko/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { PlinkoPayoutResult, PlinkoRisk } from '@/games/plinko/types'
import { PlinkoBoard, type PlinkoBall } from '@/components/plinko-board'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlinkoSession extends PlinkoBall {
  bet: number
  result: PlinkoPayoutResult
  risk: PlinkoRisk
  golden: boolean
}

interface PlinkoResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface PlinkoGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<PlinkoResult>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PlinkoGame({ mode, bankroll, onBet, onResolve }: PlinkoGameProps) {
  const router = useRouter()
  const { floorMinBet, pendingDefeatReason } = useSurvivalStore()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { plinkoGoldenBall, plinkoGoldenBallLevel } = useSurvivalPerks('plinko')
  const goldenBallProc = usePerkProc(
    mode === 'survival' && plinkoGoldenBall,
    'perk_plinko_golden_ball',
    plinkoGoldenBallLevel,
  )
  const { autoReBet } = useSettingsStore()
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [risk, setRisk] = useState<PlinkoRisk>('medium')
  const [sessions, setSessions] = useState<PlinkoSession[]>([])
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [pendingAutoReBet, setPendingAutoReBet] = useState(false)

  // Refs so the ball-complete callback never needs to be recreated
  const sessionsRef = useRef<PlinkoSession[]>([])
  sessionsRef.current = sessions
  const bankrollRef = useRef(bankroll)
  bankrollRef.current = bankroll
  // Tracks bets committed but not yet resolved — updated synchronously so rapid
  // clicks can't over-commit before React re-renders with the updated bankroll.
  const inFlightBetRef = useRef(0)
  const lastBetRef = useRef(lastBet)
  lastBetRef.current = lastBet
  const autoReBetRef = useRef(autoReBet)
  autoReBetRef.current = autoReBet
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve
  const goldenBallProcRef = useRef(goldenBallProc)
  goldenBallProcRef.current = goldenBallProc

  const isDropping = sessions.length > 0
  const commitBet = currentBet >= minBet ? currentBet : lastBet >= minBet ? lastBet : 0
  const canDrop = commitBet >= minBet && commitBet <= bankroll - inFlightBetRef.current && bankroll > 0
  const showSurvivalContinue =
    mode === 'survival' && bankroll <= 0 && !isDropping && pendingDefeatReason != null

  const statusMsg = isDropping
    ? `${sessions.length} ball${sessions.length === 1 ? '' : 's'} in flight`
    : 'Place chips and drop.'

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleDrop() {
    const bet = commitBet
    if (bet < minBet || bet > bankrollRef.current - inFlightBetRef.current) return
    inFlightBetRef.current += bet
    onBet?.(bet)
    const golden = mode === 'survival' ? goldenBallProc.rollForBet() : false
    const path = blessed ? winGamePath(risk) : cursed ? loseGamePath(risk) : generatePath()
    const result = computePayout(bet, path, risk)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const startedAt = performance.now()
    setSessions((prev) => [...prev, { id, path, startedAt, bet, result, risk, golden }])
    setLastBet(bet)
    setCurrentBet(0)
    setQuoteIdx((prev) => pickQuote(prev))
  }

  // Stable callback — uses refs for all values that change over time.
  const handleBallComplete = useCallback((id: string) => {
    const session = sessionsRef.current.find((s) => s.id === id)
    if (!session) return

    setSessions((prev) => prev.filter((s) => s.id !== id))
    inFlightBetRef.current = Math.max(0, inFlightBetRef.current - session.bet)

    const finalPayout = session.golden ? session.result.payout * 2 : session.result.payout
    const finalMultiplier = session.golden ? session.result.multiplier * 2 : session.result.multiplier
    const finalOutcome = finalPayout >= session.bet ? 'win' : 'loss'

    const resolved = resolveGame(onResolveRef.current, {
      outcome: finalOutcome,
      betAmount: session.bet,
      payout: finalPayout,
      multiplier: finalMultiplier,
    })

    goldenBallProcRef.current.resetPerk()

    const built = buildPendingResult(
      { outcome: finalOutcome, betAmount: session.bet, payout: finalPayout },
      {
        betSpecification: formatPlinkoRiskLabel(session.risk),
        result: `${finalMultiplier}×`,
        resultSpecification: formatPlinkoRiskLabel(session.risk),
      },
      { gameMultiplier: session.result.multiplier, freeBet: resolved.firstBetWasFree },
    )
    setMatchHistory((h) => [built.entry, ...h].slice(0, 80))

    // Signal autoReBet — deferred to useEffect so bankroll is post-resolve
    if (autoReBetRef.current && sessionsRef.current.length === 1) {
      setPendingAutoReBet(true)
    }
  }, []) // stable — all values read via refs

  // Deferred autoReBet: runs after resolve updates the bankroll prop
  useEffect(() => {
    if (!pendingAutoReBet) return
    setPendingAutoReBet(false)
    if (autoReBet) setCurrentBet(Math.min(lastBet, bankroll))
  }, [pendingAutoReBet, autoReBet, lastBet, bankroll])

  const balls: PlinkoBall[] = sessions.map(({ id, path, startedAt }) => ({ id, path, startedAt }))
  const goldenBallIds = sessions.filter((s) => s.golden).map((s) => s.id)

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Plinko</span>
        <span className="text-sm text-zinc-500 truncate max-w-[60%] text-right">{statusMsg}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex flex-col w-full h-full bg-[#111113]"
        entries={matchHistory}
        gameLabel="Plinko"
        emptyHint="No drops yet — results appear after each ball lands."
      >
        <GameDockBackButton mode={mode} visible={!isDropping} />
        {mode === 'survival' && goldenBallProc.perkActive && isDropping && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Golden Ball — 2× payout
          </PerkHint>
        )}
        <GameCurrentBetBadge
          betAmount={sessions.reduce((s, x) => s + x.bet, 0)}
          betSpecification={isDropping ? formatPlinkoRiskLabel(risk) : undefined}
          visible={isDropping}
        />

        <div className="flex-1 min-h-0 w-full flex flex-col">
          <div className="flex flex-col items-center gap-1 py-1.5">
            <span className="text-xs text-zinc-600 font-semibold uppercase tracking-widest">Risk</span>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as PlinkoRisk[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={isDropping}
                  onClick={() => setRisk(r)}
                  className={`px-3 py-0.5 rounded text-xs font-semibold transition-colors capitalize
                    ${risk === r
                      ? 'bg-white text-zinc-900'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:hover:bg-zinc-800'
                    } disabled:opacity-50`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PlinkoBoard
              balls={balls}
              onBallComplete={handleBallComplete}
              risk={risk}
              goldenBallIds={goldenBallIds}
            />
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={false}
            minBet={minBet}
          />

          <div className="h-10 flex items-center justify-center w-full">
            <GameDockBetRow
              currentBet={currentBet > 0 ? currentBet : isDropping ? lastBet : 0}
              onClear={() => setCurrentBet(0)}
            />
          </div>

          <div className="flex justify-center gap-2">
            {showSurvivalContinue ? (
              <>
                <button type="button" onClick={() => router.push(`/${mode}`)} className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white font-bold rounded-lg transition-colors text-base">← Leave</button>
                <button type="button" onClick={() => survivalAfterNext(mode)} className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg">Continue →</button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleDrop}
                disabled={!canDrop}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Drop →
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
