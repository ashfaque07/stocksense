// API client for the end-of-day top-gainers report.

// `today` returns the latest stored trending gainers instead of the report.
export async function fetchReport(today = false) {
  const res = await fetch(`/api/report${today ? '?today=1' : ''}`, { cache: 'no-store' })
  return res.json()
}
