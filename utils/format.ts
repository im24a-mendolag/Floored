export function formatChips(n: number): string {
  if (n >= 1_000_000_000_000_000_000) return `${(n / 1_000_000_000_000_000_000).toFixed(1)}Qi`
  if (n >= 1_000_000_000_000_000) return `${(n / 1_000_000_000_000_000).toFixed(1)}Qa`
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatMultiplier(n: number): string {
  return `${n.toFixed(2)}x`
}
