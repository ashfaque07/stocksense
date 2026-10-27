// Controller: streams an AI "what to expect" preview for a company's upcoming
// financial results.

import { isAiConfigured } from '../services/analysisService.js'
import { streamResultsAnalysis } from '../services/resultsAnalysisService.js'

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

export async function handleAnalyzeResults(req, res) {
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

  const symbol = body?.symbol?.trim()
  if (!symbol) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing stock symbol.' }))
    return
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')

  try {
    for await (const token of streamResultsAnalysis(body, body?.model)) {
      res.write(token)
    }
  } catch (err) {
    console.error('[results] analysis stream failed:', err)
    if (!res.headersSent) res.statusCode = 502
    res.write(`\n\n[Analysis failed: ${err.message}]`)
  } finally {
    res.end()
  }
}
