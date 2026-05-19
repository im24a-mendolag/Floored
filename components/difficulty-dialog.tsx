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
    description: '1× quota',
  },
  {
    value: 'hard',
    label: 'Hard',
    description: '1.5× quota',
  },
  {
    value: 'nightmare',
    label: 'Nightmare',
    description: '2.5× quota',
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
              <p>Affects house edge, spark earn rate, and shop availability.</p>
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
