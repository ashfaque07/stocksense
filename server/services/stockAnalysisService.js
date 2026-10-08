// Real-time AI fundamental analysis for a listed stock. Reuses the shared
// AI streaming/caching helper and yields markdown text tokens as they arrive.

import { streamCompletion } from './analysisService.js'
import { getNewsForQuery } from './newsService.js'
import { STOCK_SYSTEM_PROMPT, stockUserPrompt } from './prompts.js'

function buildMessages(query, news) {
  return [
    {
      role: 'system',
      content: STOCK_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: stockUserPrompt(query, news)
    }
  ]
}

// Async generator that yields markdown chunks for a stock's fundamental analysis.
export async function* streamStockAnalysis(query, model) {
  const normalized = String(query).trim()
  // Best-effort: pull recent headlines so the model reasons over fresh news.
  const news = await getNewsForQuery(normalized)
  yield* streamCompletion(buildMessages(normalized, news), `stock:${normalized.toLowerCase()}`, model)
}
