// Real-time AI fundamental analysis for a listed stock. Reuses the shared
// AI streaming/caching helper and yields markdown text tokens as they arrive.

import { streamCompletion } from './analysisService.js'
import { getNewsForQuery } from './newsService.js'
import { fetchLiveQuote } from './resultsDetailService.js'
import { STOCK_SYSTEM_PROMPT, stockUserPrompt } from './prompts.js'

function buildMessages(query, news, quote) {
  return [
    {
      role: 'system',
      content: STOCK_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: stockUserPrompt(query, news, quote)
    }
  ]
}

// Async generator that yields markdown chunks for a stock's fundamental analysis.
export async function* streamStockAnalysis(query, model) {
  const normalized = String(query).trim()
  // Best-effort: pull recent headlines so the model reasons over fresh news.
  // Live NSE quote is only attempted for ticker-like input (no spaces).
  const [news, quote] = await Promise.all([
    getNewsForQuery(normalized),
    /\s/.test(normalized) ? null : fetchLiveQuote(normalized.toUpperCase())
  ])
  yield* streamCompletion(buildMessages(normalized, news, quote), `stock:${normalized.toLowerCase()}`, model)
}
