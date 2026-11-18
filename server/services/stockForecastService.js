// Real-time AI price-movement forecast (1-4 weeks) for a listed stock. Feeds the
// model live NSE quote data, computed technical indicators and recent news.

import { streamCompletion } from './analysisService.js'
import { getNewsForQuery } from './newsService.js'
import { fetchLiveQuote } from './resultsDetailService.js'
import { getTechnicals } from './technicalService.js'
import { FORECAST_SYSTEM_PROMPT, forecastUserPrompt } from './prompts.js'

// Async generator that yields markdown chunks for a stock's price forecast.
export async function* streamStockForecast(query, model) {
  const normalized = String(query).trim()
  // Live quote and technicals need a ticker (no spaces); news works for either.
  const isTicker = !/\s/.test(normalized)
  const symbol = normalized.toUpperCase()
  const [news, quote, technicals] = await Promise.all([
    getNewsForQuery(normalized),
    isTicker ? fetchLiveQuote(symbol) : null,
    isTicker ? getTechnicals(symbol) : null
  ])
  const messages = [
    { role: 'system', content: FORECAST_SYSTEM_PROMPT },
    { role: 'user', content: forecastUserPrompt(normalized, quote, technicals, news) }
  ]
  yield* streamCompletion(messages, `forecast:${normalized.toLowerCase()}`, model)
}
