// Controller: streams an AI "best pick" analysis over the trending stocks list.

import { isAiConfigured } from '../services/analysisService.js'
import { streamTrendingAnalysis } from '../services/trendingAnalysisService.js'

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1e6) reject(new Error('Payload too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export async function handleAnalyzeTrending(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  if (!isAiConfigured()) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'AI provider not configured. Set AI_API_KEY in .env.' }))
    return
  }

  let body
  try {
    body = JSON.parse((await readBody(req)) || '{}')
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
    return
  }

  const type = body?.type === 'losers' ? 'losers' : 'gainers'
  const stocks = Array.isArray(body?.stocks) ? body.stocks : []
  if (!stocks.length) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing trending stocks list.' }))
    return
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')

  try {
    for await (const token of streamTrendingAnalysis(type, stocks, body?.model)) {
      res.write(token)
    }
  } catch (err) {
    console.error('[trending] best-pick analysis stream failed:', err)
    if (!res.headersSent) res.statusCode = 502
    res.write(`\n\n[Analysis failed: ${err.message}]`)
  } finally {
    res.end()
  }
}
