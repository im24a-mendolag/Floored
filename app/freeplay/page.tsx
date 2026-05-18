import { Lobby } from '@/components/lobby'

export default function FreeplayPage() {
  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6">
      <header className="flex shrink-0 flex-col items-center justify-center text-center min-h-[4.5rem] py-1">
        <h2 className="text-2xl font-bold leading-tight">Freeplay</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-snug">
          Pick any game with no floors or pressure
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <Lobby mode="freeplay" />
      </div>
    </div>
  )
}
