// AI "what to expect" preview for a company's upcoming financial results.
// Reuses the shared AI streaming/caching helper and yields markdown text
// tokens as they arrive.

import { streamCompletion } from './analysisService.js'
import { getNewsForQuery } from './newsService.js'
import { getResultsDetail } from './resultsDetailService.js'
import { RESULTS_SYSTEM_PROMPT, resultsUserPrompt } from './prompts.js'

function buildMessages(facts, news, quarters) {
  return [
    { role: 'system', content: RESULTS_SYSTEM_PROMPT },
    { role: 'user', content: resultsUserPrompt(facts, news, quarters) }
  ]
}

// Async generator that yields markdown chunks for an upcoming-results preview.
export async function* streamResultsAnalysis(stock, model) {
  const facts = {
    symbol: stock?.symbol || '',
    company: stock?.company || '',
    resultDate: stock?.dateLabel || stock?.date || '',
    purpose: stock?.purpose || 'Financial Results'
  }
  // Best-effort: pull recent headlines so the model reasons over fresh news.
  const news = await getNewsForQuery(facts.company || facts.symbol)
  // Best-effort: pull the last couple of reported quarters so the model grounds
  // its expectations in the company's most recent actuals.
  let quarters = []
  try {
    const detail = await getResultsDetail(facts.symbol)
    quarters = detail?.quarters || []
  } catch {
    /* preview still works without historical quarters */
  }
  const key = `results:${String(facts.symbol).toLowerCase()}:${facts.resultDate}`
  yield* streamCompletion(buildMessages(facts, news, quarters), key, model)
}
