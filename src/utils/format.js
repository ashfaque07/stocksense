// Shared number/time formatting helpers for trending views.

export const fmtNum = (n, d = 2) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

// Compact large counts (shares) using Indian abbreviations (K / L / Cr).
export const fmtCount = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const v = Number(n)
  const abs = Math.abs(v)
  if (abs >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `${(v / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return Number(v).toLocaleString('en-IN')
}

// Compact large numbers (₹ lakh) using Indian abbreviations (K / L / Cr).
export const fmtCompact = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const v = Number(n)
  const abs = Math.abs(v)
  if (abs >= 100) return `${(v / 100).toFixed(2)}Cr`
  if (abs >= 1) return `${v.toFixed(2)}L`
  return `${(v * 100).toFixed(2)}K`
}

// Show an ISO timestamp as IST time (HH:MM).
export const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  })
}
