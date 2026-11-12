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

const MONTH_NUM = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}

// Show a date as DD-MM-YYYY (IST). Accepts a plain "YYYY-MM-DD", an NSE-style
// "14-Nov-2026", or any ISO timestamp. Returns `fallback` when empty/unparseable.
export const fmtDate = (value, fallback = '—') => {
  if (!value) return fallback
  const s = String(value).trim()

  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (plain) return `${plain[3]}-${plain[2]}-${plain[1]}`

  const nse = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s)
  if (nse && MONTH_NUM[nse[2].toLowerCase()]) {
    return `${nse[1].padStart(2, '0')}-${MONTH_NUM[nse[2].toLowerCase()]}-${nse[3]}`
  }

  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return fallback
  return d
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    })
    .replace(/\//g, '-')
}
