// Controller: serves upcoming financial-results board meetings from NSE.

import { getUpcomingResults } from '../services/resultsService.js'

export async function handleGetResults(req, res) {
  res.setHeader('Content-Type', 'application/json')

  try {
    const data = await getUpcomingResults()
    res.end(JSON.stringify(data))
  } catch (err) {
    console.error('[results] fetch failed:', err)
    res.statusCode = 502
    res.end(
      JSON.stringify({
        source: 'error',
        count: 0,
        results: [],
        error: `Could not fetch upcoming results from NSE: ${err.message}`
      })
    )
  }
}
