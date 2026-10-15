// Native Netlify Function serving the IPO API.
// Routes: GET /api/ipos, POST /api/analyze
// Calls the shared service layer directly (no serverless-http wrapper), which
// is more reliable and easier to debug on Netlify.

import { connectLambda } from '@netlify/blobs'
import { getIpos } from '../../server/services/ipoService.js'
import { isAiConfigured, streamAnalysis } from '../../server/services/analysisService.js'
import { streamStockAnalysis } from '../../server/services/stockAnalysisService.js'
import { streamTrendingAnalysis } from '../../server/services/trendingAnalysisService.js'
import {
  readTrending,
  refreshTrending,
  loadHolidays,
  isMarketOpen
} from '../../server/services/trendingService.js'
import { AI_MODEL_NAMES, DEFAULT_MODEL } from '../../server/config/index.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export const handler = async (event) => {
  // Legacy (v1) Netlify Functions don't auto-configure Netlify Blobs; wire the
  // request context in so getStore() works.
  connectLambda(event)

  const method = event.httpMethod
  const path = event.path || ''

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  try {
    if (path.includes('/models')) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: AI_MODEL_NAMES, default: DEFAULT_MODEL })
      }
    }

    if (path.includes('/ipos')) {
      const data = await getIpos()
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }
    }

    if (path.includes('/analyze-trending')) {
      if (method !== 'POST') {
        return { statusCode: 405, headers: CORS, body: 'Method not allowed' }
      }
      if (!isAiConfigured()) {
        return {
          statusCode: 503,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'AI provider not configured. Set AI_API_KEY.' })
        }
      }

      let payload
      try {
        payload = JSON.parse(event.body || '{}')
      } catch {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON body.' })
        }
      }
      const trendType = payload?.type === 'losers' ? 'losers' : 'gainers'
      const trendStocks = Array.isArray(payload?.stocks) ? payload.stocks : []
      if (!trendStocks.length) {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing trending stocks list.' })
        }
      }

      let trendingText = ''
      try {
        for await (const token of streamTrendingAnalysis(trendType, trendStocks, payload?.model)) {
          trendingText += token
        }
      } catch (err) {
        return {
          statusCode: 502,
          headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
          body: `${trendingText}\n\n[Analysis failed: ${err.message}]`
        }
      }
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
        body: trendingText
      }
    }

    if (path.includes('/trending-refresh')) {
      try {
        await loadHolidays()
        const marketOpen = isMarketOpen()
        const results = []
        for (const type of ['gainers', 'losers']) {
          try {
            const snap = await refreshTrending(type)
            results.push({
              type,
              count: snap.count,
              dayStartedAt: snap.dayStartedAt,
              updatedAt: snap.updatedAt
            })
          } catch (err) {
            results.push({ type, error: err.message })
          }
        }
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketOpen, results })
        }
      } catch (err) {
        return {
          statusCode: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: err.message })
        }
      }
    }

    if (path.includes('/trending')) {
      const type = event.queryStringParameters?.type || 'gainers'
      const force = event.queryStringParameters?.refresh === '1'
      try {
        const data = force ? await refreshTrending(type) : await readTrending(type)
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      } catch (err) {
        return {
          statusCode: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'error',
            type,
            count: 0,
            stocks: [],
            error: `Could not fetch trending stocks from NSE: ${err.message}`
          })
        }
      }
    }

    if (path.includes('/analyze-stock')) {
      if (method !== 'POST') {
        return { statusCode: 405, headers: CORS, body: 'Method not allowed' }
      }
      if (!isAiConfigured()) {
        return {
          statusCode: 503,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'AI provider not configured. Set AI_API_KEY.' })
        }
      }

      let query
      let stockModel
      try {
        const parsed = JSON.parse(event.body || '{}')
        query = parsed?.query?.trim()
        stockModel = parsed?.model
      } catch {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON body.' })
        }
      }
      if (!query) {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing stock name or ticker.' })
        }
      }

      let stockText = ''
      try {
        for await (const token of streamStockAnalysis(query, stockModel)) {
          stockText += token
        }
      } catch (err) {
        return {
          statusCode: 502,
          headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
          body: `${stockText}\n\n[Analysis failed: ${err.message}]`
        }
      }
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
        body: stockText
      }
    }

    if (path.includes('/analyze')) {
      if (method !== 'POST') {
        return { statusCode: 405, headers: CORS, body: 'Method not allowed' }
      }
      if (!isAiConfigured()) {
        return {
          statusCode: 503,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'AI provider not configured. Set AI_API_KEY.' })
        }
      }

      let ipo
      try {
        ipo = JSON.parse(event.body || '{}')
      } catch {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON body.' })
        }
      }
      if (!ipo || !ipo.company) {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing IPO data.' })
        }
      }

      // Serverless functions can't stream a chunked response, so collect the
      // tokens and return the full analysis text at once.
      let text = ''
      try {
        for await (const token of streamAnalysis(ipo, ipo.model)) {
          text += token
        }
      } catch (err) {
        return {
          statusCode: 502,
          headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
          body: `${text}\n\n[Analysis failed: ${err.message}]`
        }
      }
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
        body: text
      }
    }

    return { statusCode: 404, headers: CORS, body: 'Not found' }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    }
  }
}
