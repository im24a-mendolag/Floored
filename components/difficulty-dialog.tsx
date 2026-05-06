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

interface Props {
  open: boolean
  onClose: () => void
}

const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Standard house edge. Full spark earn rate. Full shop catalogue.',
  },
  {
    value: 'hard',
    label: 'Hard',
    description: '+10% house edge. −25% sparks. Shop shows 3 random picks per visit.',
  },
  {
    value: 'nightmare',
    label: 'Nightmare',
    description: '+20% house edge. −50% sparks. Shop: 2 picks, costs doubled.',
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Difficulty</DialogTitle>
          <DialogDescription>
            Affects house edge, spark earn rate, and shop availability. You always start with
            1,000 chips.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          {DIFFICULTIES.map((d) => (
            <Button
              key={d.value}
              variant="outline"
              className="h-auto py-3 flex-col items-start text-left"
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
