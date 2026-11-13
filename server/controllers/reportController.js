// Controller: serves the stored end-of-day top-gainers report.

import { getReport, getLatestGainers } from '../services/reportService.js'

export async function handleGetReport(req, res) {
  res.setHeader('Content-Type', 'application/json')

  try {
    const today = new URL(req.url, 'http://localhost').searchParams.get('today') === '1'
    res.end(JSON.stringify(today ? await getLatestGainers() : await getReport()))
  } catch (err) {
    console.error('[report] fetch failed:', err)
    res.statusCode = 502
    res.end(JSON.stringify({ source: 'error', count: 0, records: [], error: `Could not load report: ${err.message}` }))
  }
}
