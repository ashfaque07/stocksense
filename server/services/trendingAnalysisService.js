// AI "best pick" analysis over the live trending stocks list. Reuses the shared
// AI streaming/caching helper and yields markdown text tokens as they arrive.

import { streamCompletion, isAiConfigured } from './analysisService.js'
import { enrichFactsWithNews } from './newsService.js'
import { getModelFallbacks } from '../config/index.js'
import {
  TRENDING_BEST_PICK_SYSTEM_PROMPT,
  trendingBestPickUserPrompt,
  trendingBestSymbolsSystemPrompt,
  trendingBestSymbolsUserPrompt
} from './prompts.js'

// Keep only the fields useful for analysis so the prompt stays compact and the
// cache key is stable across noisy fields.
function stockFacts(s) {
  return {
    symbol: s.symbol,
    ltp: s.ltp ?? null,
    open: s.open ?? null,
    high: s.high ?? null,
    low: s.low ?? null,
    prevClose: s.prevClose ?? null,
    change: s.change ?? null,
    percentChange: s.percentChange ?? null,
    volume: s.volume ?? null,
    turnover: s.turnover ?? null,
    reason: s.reason || ''
  }
}

function buildMessages(type, facts) {
  const listLabel = type === 'losers' ? 'top losers' : 'top gainers'

  return [
    {
      role: 'system',
      content: TRENDING_BEST_PICK_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: trendingBestPickUserPrompt(listLabel, facts)
    }
  ]
}

// Build a stable cache key from the symbols and their % change so identical
// snapshots reuse the cached analysis.
function cacheKey(type, stocks) {
  const sig = stocks
    .map((s) => `${s.symbol}:${s.percentChange ?? ''}`)
    .join('|')
  return `trending-best:${type}:${sig}`
}

// Keep only currently-available (non-stale) stocks. Stale stocks are ones that
// were seen earlier today but dropped out of the latest live refresh; their
// data is outdated so they must not be considered for the AI best pick.
function availableStocks(stocks) {
  return (Array.isArray(stocks) ? stocks : []).filter((s) => !s?.stale)
}

// Short cache for the best-pick analysis. Trending snapshots refresh frequently,
// so a brief window dedupes repeated clicks without serving stale picks.
const BEST_PICK_CACHE_TTL_MS = 1 * 60 * 1000

// Async generator that yields markdown chunks for the best-pick analysis.
export async function* streamTrendingAnalysis(type, stocks, model) {
  const fresh = availableStocks(stocks)
  // Enrich with recent news headlines so the AI reasons over real catalysts
  // instead of reporting it has no live news. Best-effort — failures yield
  // empty `news` arrays and the analysis still runs on intraday data.
  const facts = await enrichFactsWithNews(fresh.map(stockFacts))
  yield* streamCompletion(buildMessages(type, facts), cacheKey(type, fresh), model, { ttl: BEST_PICK_CACHE_TTL_MS })
}

// Overall budget for the refresh-time AI flagging. `streamCompletion` retries
// across models with its own per-request idle timeout, so without an outer cap
// a slow/hung provider could block the trending refresh (and the HTTP response
// the browser is waiting on) for minutes. The flagging is best-effort, so we
// bound the whole thing and fall back to "no new flags" when it's exceeded.
//
// The budget must comfortably exceed the primary model's time-to-first-token:
// reasoning models (e.g. Groq `gpt-oss-120b`) routinely take ~25–30s of
// server-side reasoning before emitting the JSON, so too tight a cap times out
// every refresh and nothing ever gets flagged. Keep it under the per-request
// idle timeout (AI_REQUEST_TIMEOUT_MS, default 45s) so a single attempt can finish.
const RECOMMEND_TIMEOUT_MS = Number(process.env.TRENDING_RECOMMEND_TIMEOUT_MS) || 600000

// Ask the AI to pick the best `limit` stocks from the trending list and return
// their symbols. Used at refresh time to flag `aiRecommended` stocks. Returns
// an array of uppercase symbols (a subset of the provided list); on any failure
// or if the overall time budget is exceeded it returns an empty array so the
// refresh never breaks or hangs.
export async function recommendBestSymbols(type, stocks, limit = 3) {
  // The primary model is the one still in-flight when the budget is exceeded
  // (its per-request idle timeout is longer than this outer budget, so a fallback
  // hasn't kicked in yet). Name it so the log points at the actual culprit.
  const stuckModel = getModelFallbacks(undefined)[0]?.model || 'none configured'
  // Clear the loser timer once the inner call settles, otherwise it keeps
  // running and logs a misleading "timed out" message after a successful result.
  let timer
  try {
    return await Promise.race([
      recommendBestSymbolsInner(type, stocks, limit),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          console.error(
            `[trending] AI recommendation timed out after ${RECOMMEND_TIMEOUT_MS}ms ` +
              `(type=${type}, model: ${stuckModel}); skipping flags`
          )
          resolve([])
        }, RECOMMEND_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function recommendBestSymbolsInner(type, stocks, limit = 3) {
  const live = availableStocks(stocks)
  if (!isAiConfigured() || !live.length) return []

  const valid = new Set(live.map((s) => String(s.symbol).toUpperCase()))
  const facts = live.map(stockFacts)
  const listLabel = type === 'losers' ? 'top losers' : 'top gainers'

  const messages = [
    {
      role: 'system',
      content: trendingBestSymbolsSystemPrompt(limit)
    },
    {
      role: 'user',
      content: trendingBestSymbolsUserPrompt(listLabel, facts)
    }
  ]

  try {
    let text = ''
    for await (const token of streamCompletion(messages, `${cacheKey(type, live)}:best-symbols:${limit}`, undefined, { noCache: true })) {
      text += token
    }
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((s) => String(s).toUpperCase().trim())
      .filter((s) => valid.has(s))
      .slice(0, limit)
  } catch (err) {
    console.error('[trending] AI recommendation failed:', err.message)
    return []
  }
}
