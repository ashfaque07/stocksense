// Repository: fetches recent news headlines for a stock symbol from Google News
// RSS (no API key required) and parses them into clean, structured items.
//
// Results are cached in memory per symbol for a short TTL so repeated best-pick
// requests within a refresh window don't re-hit the RSS endpoint. The RSS feed
// is lightweight XML, so we parse it with small, targeted regexes and reuse the
// shared `stripTags` / `decodeEntities` helpers to sanitize upstream text.

import {
  NEWS_RSS_HOST,
  NEWS_MAX_PER_SYMBOL,
  NEWS_MAX_AGE_HOURS,
  NEWS_CACHE_TTL_MS,
  NEWS_FETCH_TIMEOUT_MS
} from '../config/index.js'
import { stripTags, decodeEntities } from '../utils/html.js'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
  'Accept-Language': 'en-US,en;q=0.9'
}

// Simple in-memory cache keyed by symbol -> { items, expires }.
const cache = new Map()

function getCached(symbol) {
  const entry = cache.get(symbol)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(symbol)
    return null
  }
  return entry.items
}

function setCached(symbol, items) {
  cache.set(symbol, { items, expires: Date.now() + NEWS_CACHE_TTL_MS })
}

// Extract the text of the first matching tag within a block (RSS <item>).
function pickTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return ''
  // Strip CDATA wrappers, HTML tags, then decode entities.
  const inner = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return stripTags(inner)
}

// Parse the Google News RSS XML into clean headline items, newest first, and
// drop anything older than the freshness window.
function parseRss(xml) {
  const items = []
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || []
  const minTime = Date.now() - NEWS_MAX_AGE_HOURS * 60 * 60 * 1000

  for (const block of blocks) {
    const title = pickTag(block, 'title')
    if (!title) continue
    const pubDateRaw = pickTag(block, 'pubDate')
    const published = pubDateRaw ? Date.parse(pubDateRaw) : NaN
    // Skip stale headlines; keep undated ones (treated as recent).
    if (!Number.isNaN(published) && published < minTime) continue
    // Google News titles are usually "Headline - Publisher"; split the source.
    const sourceTag = pickTag(block, 'source')
    let headline = title
    let source = sourceTag
    if (!source) {
      const idx = title.lastIndexOf(' - ')
      if (idx > 0) {
        headline = title.slice(0, idx).trim()
        source = title.slice(idx + 3).trim()
      }
    }
    items.push({
      title: decodeEntities(headline),
      source: decodeEntities(source) || null,
      publishedAt: Number.isNaN(published) ? null : new Date(published).toISOString()
    })
  }

  // Newest first (undated sink to the bottom), capped.
  items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  return items.slice(0, NEWS_MAX_PER_SYMBOL)
}

// Build the Google News RSS search URL for an NSE-listed company symbol.
function buildQueryUrl(symbol) {
  const q = encodeURIComponent(`${symbol} stock NSE share`)
  return `${NEWS_RSS_HOST}?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`
}

// Fetch recent headlines for a single symbol. Returns [] on any failure so the
// best-pick flow degrades gracefully (news is best-effort enrichment).
export async function getSymbolNews(symbol) {
  if (!symbol) return []
  const cached = getCached(symbol)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(buildQueryUrl(symbol), {
      headers: BROWSER_HEADERS,
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`news RSS status ${res.status}`)
    const xml = await res.text()
    const items = parseRss(xml)
    setCached(symbol, items)
    return items
  } catch (err) {
    console.error(`[news] failed to fetch headlines for ${symbol}:`, err.message)
    return []
  } finally {
    clearTimeout(timer)
  }
}
