// Service: enriches trending-stock facts with recent news headlines so the AI
// best-pick analysis reasons over real, fresh catalysts instead of reporting it
// has no live news. News is best-effort — a symbol with no (or failed) lookups
// simply gets an empty `news` array, and the model handles that per the prompt.

import { getSymbolNews } from '../repositories/newsRepository.js'
import { NEWS_FETCH_CONCURRENCY } from '../config/index.js'

// Run an async mapper over items with a bounded concurrency so we don't fire
// one RSS request per symbol simultaneously (keeps us a polite client).
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

// Attach a `news` array (recent headlines) to each stock-facts object. The
// input/output shape is otherwise untouched so callers can drop this in before
// building the AI prompt.
export async function enrichFactsWithNews(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return facts
  return mapWithConcurrency(facts, NEWS_FETCH_CONCURRENCY, async (fact) => {
    const news = await getSymbolNews(fact.symbol)
    return { ...fact, news }
  })
}

// Fetch recent headlines for a single company name or ticker. Best-effort —
// returns [] on failure so the stock analysis still runs on model knowledge.
export async function getNewsForQuery(query) {
  const term = String(query || '').trim()
  if (!term) return []
  return getSymbolNews(term)
}
