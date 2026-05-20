const CHIP_SUFFIXES: [number, string][] = [
  [1e63, 'Vg'],   // vigintillion
  [1e60, 'Nod'],  // novemdecillion
  [1e57, 'Ocd'],  // octodecillion
  [1e54, 'Spd'],  // septendecillion
  [1e51, 'Sxd'],  // sexdecillion
  [1e48, 'Qid'],  // quindecillion
  [1e45, 'Qad'],  // quattuordecillion
  [1e42, 'Td'],   // tredecillion
  [1e39, 'Dd'],   // duodecillion
  [1e36, 'Ud'],   // undecillion
  [1e33, 'Dc'],   // decillion
  [1e30, 'No'],   // nonillion
  [1e27, 'Oc'],   // octillion
  [1e24, 'Sp'],   // septillion
  [1e21, 'Sx'],   // sextillion
  [1e18, 'Qi'],   // quintillion
  [1e15, 'Qa'],   // quadrillion
  [1e12, 'T'],    // trillion
  [1e9,  'B'],    // billion
  [1e6,  'M'],    // million
  [1e3,  'K'],    // thousand
]

export function formatChips(n: number): string {
  if (n < 0) return `-${formatChips(-n)}`
  for (const [threshold, suffix] of CHIP_SUFFIXES) {
    if (n >= threshold) return `${(n / threshold).toFixed(1)}${suffix}`
  }
  return n.toString()
}

export function formatMultiplier(n: number): string {
  return `${n.toFixed(2)}x`
}

export function parseChips(s: string): number | null {
  const lower = s.trim().toLowerCase()
  if (!lower) return null
  // Check longest suffixes first to avoid partial matches (e.g. "Nod" before "No")
  for (const [threshold, suffix] of CHIP_SUFFIXES) {
    if (lower.endsWith(suffix.toLowerCase())) {
      const numPart = lower.slice(0, -suffix.length).trim()
      const n = parseFloat(numPart)
      if (!isNaN(n) && isFinite(n)) return n * threshold
    }
  }
  const n = parseFloat(lower)
  return !isNaN(n) && isFinite(n) ? n : null
}
