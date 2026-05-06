import { ModeSelect } from '@/components/mode-select'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-2 tracking-tight">FLOORED</h1>
      <p className="text-muted-foreground mb-10">
        Start with 1,000 chips. Survive as long as you can.
      </p>
      <ModeSelect />
    </div>
  )
}
