// API client for the end-of-day top-gainers report.

export async function fetchReport() {
  const res = await fetch('/api/report', { cache: 'no-store' })
  return res.json()
}
