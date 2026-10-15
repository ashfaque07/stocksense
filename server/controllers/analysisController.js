// Controller: streams real-time AI analysis for a single IPO to the client.

import { isAiConfigured, streamAnalysis } from '../services/analysisService.js'

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

export async function handleAnalyze(req, res) {
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

  let ipo
  try {
    ipo = JSON.parse((await readBody(req)) || '{}')
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
    return
  }

  if (!ipo || !ipo.company) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing IPO data.' }))
    return
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')

  try {
    for await (const token of streamAnalysis(ipo, ipo.model)) {
      res.write(token)
    }
  } catch (err) {
    console.error('Analysis stream failed:', err)
    if (!res.headersSent) res.statusCode = 502
    res.write(`\n\n[Analysis failed: ${err.message}]`)
  } finally {
    res.end()
  }
}
