'use client'

import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSurvivalStore } from '@/store/survival-store'
import type { Difficulty } from '@/store/types'
import {
  DIFFICULTY_QUOTA_MULT,
  DIFFICULTY_SHOP_PRICE_MULT,
} from '@/lib/survival/balance'

interface Props {
  open: boolean
  onClose: () => void
}

function formatMult(n: number): string {
  return n === 1 ? '1×' : `${n}×`
}

const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: `${formatMult(DIFFICULTY_QUOTA_MULT.normal)} quota · ${formatMult(DIFFICULTY_SHOP_PRICE_MULT.normal)} shop prices`,
  },
  {
    value: 'hard',
    label: 'Hard',
    description: `${formatMult(DIFFICULTY_QUOTA_MULT.hard)} quota · ${formatMult(DIFFICULTY_SHOP_PRICE_MULT.hard)} shop prices`,
  },
  {
    value: 'nightmare',
    label: 'Nightmare',
    description: `${formatMult(DIFFICULTY_QUOTA_MULT.nightmare)} quota · ${formatMult(DIFFICULTY_SHOP_PRICE_MULT.nightmare)} shop prices`,
  },
]

export function DifficultyDialog({ open, onClose }: Props) {
  const router = useRouter()
  const startRun = useSurvivalStore((s) => s.startRun)

  function handleSelect(difficulty: Difficulty) {
    startRun(difficulty)
    onClose()
    router.push('/survival')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose Difficulty</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>
                Difficulty scales <strong className="font-medium text-foreground">floor quota goals</strong> and{' '}
                <strong className="font-medium text-foreground">shop prices</strong> for the whole run.
              </p>
              <p>You always start with 1,000 chips.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4 items-center">
          {DIFFICULTIES.map((d) => (
            <Button
              key={d.value}
              variant="outline"
              className="w-full h-auto py-3 flex-col items-center text-center"
              onClick={() => handleSelect(d.value)}
            >
              <span className="font-semibold">{d.label}</span>
              <span className="text-xs text-muted-foreground font-normal mt-0.5">
                {d.description}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
