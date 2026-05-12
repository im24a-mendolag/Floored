import { ModeSelect } from '@/components/mode-select'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      <div className="text-center mb-12">
        <h1 className="text-7xl sm:text-8xl font-black tracking-[0.2em] uppercase text-white mb-4 leading-none">
          FLOORED
        </h1>
        <p className="text-white/30 text-[11px] tracking-[0.3em] uppercase">
          Start with 1,000 chips &middot; Survive as long as you can
        </p>
      </div>
      <ModeSelect />
    </div>
  )
}
