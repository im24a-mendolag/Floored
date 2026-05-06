import { Lobby } from '@/components/lobby'

export default function FreeplayPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">Freeplay</h2>
        <p className="text-muted-foreground mt-1">Pick any game. No floors, no pressure.</p>
      </div>
      <Lobby mode="freeplay" />
    </div>
  )
}
