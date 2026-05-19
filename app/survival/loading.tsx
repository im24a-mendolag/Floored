export default function SurvivalLoading() {
  return (
    <div className="flex flex-1 min-h-0 gap-3 animate-pulse">
      <div className="hidden lg:flex flex-col gap-2 w-44 shrink-0">
        <div className="rounded-xl bg-zinc-900 h-48" />
        <div className="rounded-xl bg-zinc-900 h-32" />
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="rounded-2xl bg-zinc-900 h-16" />
        <div className="rounded-2xl bg-zinc-900 flex-1 min-h-[400px]" />
      </div>

      <div className="hidden lg:flex flex-col gap-3 w-48 shrink-0">
        <div className="rounded-xl bg-zinc-900 h-52" />
        <div className="rounded-xl bg-zinc-900 h-20" />
      </div>
    </div>
  )
}
