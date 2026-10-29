// Controller: serves recent quarterly financial results for one NSE symbol.

import { getResultsDetail } from '../services/resultsDetailService.js'

export async function handleGetResultsDetail(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const symbol = new URL(req.url, 'http://localhost').searchParams.get('symbol')
  if (!symbol?.trim()) {
    res.statusCode = 400
    res.end(JSON.stringify({ source: 'error', quarters: [], error: 'Missing stock symbol.' }))
    return
  }

  try {
    const data = await getResultsDetail(symbol)
    res.end(JSON.stringify(data))
  } catch (err) {
    console.error('[results-detail] fetch failed:', err)
    res.statusCode = 502
    res.end(
      JSON.stringify({
        source: 'error',
        quarters: [],
        error: `Could not fetch quarterly results from NSE: ${err.message}`
      })
    )
  }
}
