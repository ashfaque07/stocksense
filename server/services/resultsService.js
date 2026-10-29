// Service layer: fetches UPCOMING financial-results board meetings from NSE.
//
// NSE publishes forthcoming board meetings (including the ones called to
// consider quarterly/annual financial results) via a JSON API. We reuse the
// same resilience strategy as the trending feed: try the JSON endpoint directly
// first (cheap, no cookies) and only fall back to the cookie handshake if NSE
// challenges the request. Rows are filtered to results-related meetings dated
// today or later (IST), normalized, and returned sorted by soonest date.

import { stripTags } from '../utils/html.js'

const NSE_BASE = 'https://www.nseindia.com'
const NSE_REFERER = `${NSE_BASE}/companies-listing/corporate-filings-event-calendar`
const RESULTS_URL = `${NSE_BASE}/api/event-calendar`

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: NSE_REFERER
}

// Grab a fresh cookie jar from NSE by loading a normal page.
async function getCookies() {
  const res = await fetch(NSE_REFERER, { headers: BROWSER_HEADERS })
  const cookies = res.headers.getSetCookie?.() || []
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

// Fetch an NSE JSON endpoint, trying without cookies first and falling back to
// the cookie handshake only if the direct call fails or returns non-JSON.
export async function fetchNseJson(url) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (res.ok) return await res.json()
  } catch {
    /* fall through to cookie handshake */
  }

  const cookie = await getCookies()
  const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: cookie } })
  if (!res.ok) {
    throw new Error(`NSE responded with status ${res.status}`)
  }
  return res.json()
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}

// Parse NSE's "10-Jan-2026" (or "10-Jan-2026 10:30") date into a UTC timestamp
// pinned to IST midnight. Returns null when unparseable.
function parseNseDate(raw) {
  const s = (raw ?? '').toString().trim()
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s)
  if (!m) return null
  const day = Number(m[1])
  const month = MONTHS[m[2].toLowerCase()]
  const year = Number(m[3])
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return null
  // Treat the calendar day as IST (UTC+5:30) midnight.
  return Date.UTC(year, month, day) - (5 * 60 + 30) * 60 * 1000
}

// Calendar day key (YYYY-MM-DD) in IST, used to drop past meetings.
function istDayKey(ts = Date.now()) {
  const ist = new Date(ts + (5 * 60 + 30) * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

// Pull a value from the first present key (NSE field names vary across feeds).
function pick(row, keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return ''
}

// A row is "results" if its purpose/description mentions financial results.
function isResults(row) {
  const text = `${pick(row, ['bm_purpose', 'purpose'])} ${pick(row, ['bm_desc', 'desc'])}`.toLowerCase()
  return /result/.test(text)
}

// Map a raw NSE board-meeting row into a clean, UI-friendly object.
function normalizeRow(row) {
  const rawDate = pick(row, ['bm_date', 'meetingDate', 'date'])
  const dateTs = parseNseDate(rawDate)
  return {
    symbol: stripTags(pick(row, ['symbol', 'bm_symbol'])),
    company: stripTags(pick(row, ['sm_name', 'companyName', 'company'])),
    isin: stripTags(pick(row, ['sm_isin', 'isin'])),
    date: dateTs ? new Date(dateTs).toISOString() : null,
    dateLabel: stripTags(rawDate),
    purpose: stripTags(pick(row, ['bm_purpose', 'purpose'])) || 'Financial Results',
    description: stripTags(pick(row, ['bm_desc', 'desc'])),
    broadcastDate: stripTags(pick(row, ['caBroadcastDate', 'broadcastDate']))
  }
}

// Fetch upcoming financial-results board meetings from NSE (today or later),
// sorted soonest first.
export async function getUpcomingResults() {
  const json = await fetchNseJson(RESULTS_URL)
  const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
  const today = istDayKey()

  const results = rows
    .filter(isResults)
    .map(normalizeRow)
    .filter((r) => r.symbol && r.date && r.date.slice(0, 10) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    source: 'live',
    timestamp: new Date().toISOString(),
    count: results.length,
    results
  }
}
