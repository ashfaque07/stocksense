// Real-time AI IPO analysis via an OpenAI-compatible streaming endpoint
// (Gemini by default). Yields text tokens as they arrive from the provider.

import { AI_PROVIDERS, getModelFallbacks } from '../config/index.js'
import { IPO_SYSTEM_PROMPT, ipoUserPrompt } from './prompts.js'

export function isAiConfigured() {
  return AI_PROVIDERS.length > 0
}

// In-memory cache of generated summaries, keyed by the IPO's analysis-relevant
// fields. Avoids re-calling the AI (cost + latency) for unchanged IPO data.
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS) || 30 * 60 * 1000
const cache = new Map()

function ipoFacts(ipo) {
  return {
    company: ipo.company,
    type: ipo.type,
    status: ipo.status,
    gmp: ipo.gmp,
    gmpPercent: ipo.gmpPercent,
    rating: ipo.rating,
    ratingValue: ipo.ratingValue,
    priceBand: ipo.priceBand,
    lotSize: ipo.lotSize,
    issueSize: ipo.issueSize,
    pe: ipo.pe,
    subscription: ipo.subscription,
    anchor: ipo.anchor,
    openDate: ipo.openDate,
    closeDate: ipo.closeDate,
    listingDate: ipo.listingDate
  }
}

function cacheKey(ipo) {
  return JSON.stringify(ipoFacts(ipo))
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.text
}

function setCached(key, text, ttl = CACHE_TTL_MS) {
  if (text) cache.set(key, { text, expires: Date.now() + ttl })
}

function buildMessages(ipo) {
  const facts = ipoFacts(ipo)

  return [
    {
      role: 'system',
      content: IPO_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: ipoUserPrompt(facts)
    }
  ]
}

// Async generator that yields text chunks streamed from the AI provider.
// Returns a cached summary instantly on a hit; otherwise streams from the AI,
// retries transient errors (503/429) with backoff and falls back across models,
// then caches the full result. `model` selects which configured model to use.
export async function* streamAnalysis(ipo, model) {
  yield* streamCompletion(buildMessages(ipo), cacheKey(ipo), model)
}

// Generic streaming completion helper shared by IPO and stock analysis.
// Yields text chunks from the AI provider, retries transient errors (503/429)
// with backoff, falls back across the configured models (starting with the
// selected one), and caches the full result by key. Output is cached per model
// since different models produce different text.
export async function* streamCompletion(messages, key, selectedModel, options = {}) {
  const { noCache = false, ttl = CACHE_TTL_MS } = options
  const fallbacks = getModelFallbacks(selectedModel)
  // The model the user actually chose (first in the fallback list). We surface
  // its error rather than a fallback's, so the message matches their selection.
  const primaryModel = fallbacks[0]?.model
  const cacheId = `${selectedModel || 'default'}:${key}`
  if (!noCache) {
    const cached = getCached(cacheId)
    if (cached) {
      yield cached
      return
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  // Upstream statuses worth retrying: rate limits (429), and transient server
  // errors / gateway failures (500/502/503/504) that AI providers emit under load.
  const isTransient = (status) =>
    status === 429 || status === 500 || status === 502 || status === 503 || status === 504
  // Abort a request that STALLS (no bytes for this long) so a hung provider
  // doesn't cause a platform 502. This is an idle timeout — it resets on every
  // received token, so slow-but-active long streams (e.g. best-pick) aren't cut off.
  const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45000
  let lastError = null
  // The error from the user's selected model, kept separate so a later fallback
  // failure (e.g. a rate-limited gemini) doesn't overwrite what the user sees.
  let primaryError = null
  // Once we've yielded any token to the consumer we can't cleanly retry or fall
  // back (it would duplicate output), so a mid-stream failure past this point
  // must be surfaced rather than retried.
  let emitted = false

  for (const { model, apiKey, baseUrl } of fallbacks) {
    const isPrimary = model === primaryModel
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController()
      let timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      // Reset the idle timer whenever we make progress (response starts / a token arrives).
      const bumpTimeout = () => {
        clearTimeout(timer)
        timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      }
      let upstream
      try {
        upstream = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model, messages, temperature: 0.4, stream: true }),
          signal: controller.signal
        })
      } catch (err) {
        clearTimeout(timer)
        // Node wraps the real reason in `err.cause` (DNS, TLS, ECONNREFUSED,
        // timeout/abort). Surface it so "fetch failed" isn't opaque.
        const reason = err.name === 'AbortError'
          ? `request timed out or was aborted after ${REQUEST_TIMEOUT_MS}ms`
          : (err.cause?.message || err.cause?.code || err.message)
        lastError = new Error(`Network error contacting AI provider (${model}): ${reason}`)
        if (isPrimary) primaryError = lastError
        await sleep(500 * (attempt + 1))
        continue
      }

      if (upstream.ok && upstream.body) {
        let full = ''
        try {
          for await (const token of readStream(upstream.body)) {
            bumpTimeout()
            full += token
            emitted = true
            yield token
          }
        } catch (err) {
          clearTimeout(timer)
          lastError = new Error(`AI stream interrupted on ${model}: ${err.message}`)
          if (isPrimary) primaryError = lastError
          // Already sent partial output — can't retry without duplicating.
          if (emitted) throw lastError
          await sleep(600 * (attempt + 1))
          continue
        }
        clearTimeout(timer)

        // A 200 with no tokens (safety block, SSE error event, or empty body):
        // don't cache/return the empty result — retry, then fall back.
        if (!full) {
          lastError = new Error(`AI returned an empty response on ${model}.`)
          if (isPrimary) primaryError = lastError
          await sleep(600 * (attempt + 1))
          continue
        }

        if (!noCache) setCached(cacheId, full, ttl)
        return
      }

      clearTimeout(timer)
      const detail = await upstream.text().catch(() => '')
      lastError = new Error(`AI request failed (${upstream.status}) on ${model}: ${detail}`)
      if (isPrimary) primaryError = lastError

      // Transient — retry same model with backoff, then move to next model.
      if (isTransient(upstream.status)) {
        await sleep(600 * (attempt + 1))
        continue
      }

      // Non-transient (e.g. 400/404) — skip to the next model immediately.
      break
    }
  }

  throw primaryError ?? lastError ?? new Error('AI request failed: no models available.')
}

// Parses an OpenAI-style SSE stream body and yields text tokens.
async function* readStream(body) {
  const decoder = new TextDecoder()
  let buffer = ''

  for await (const value of body) {
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return

      try {
        const chunk = JSON.parse(payload)
        const token = chunk.choices?.[0]?.delta?.content
        if (token) yield token
      } catch {
        // Ignore partial or malformed chunks.
      }
    }
  }
}
