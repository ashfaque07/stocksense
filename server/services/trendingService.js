// Service layer: fetches live trending stocks (top gainers / losers) from NSE.
//
// We try NSE's JSON API directly (no cookies) first, which usually works and
// avoids downloading a heavy HTML page just to obtain cookies. Only if that
// fails (NSE bot-protection challenges some datacenter IPs) do we fall back to
// the cookie handshake and retry. We read the "All Securities" (allSec) bucket.
//
// A daily snapshot is persisted so every stock keeps a `createdAt` (set when
// the trading day starts, i.e. the first refresh at/after 09:00 IST) and a
// `modifiedAt` (updated on every 15-minute refresh).

import {
  IST_OFFSET_MIN,
  MARKET_OPEN_MIN,
  MARKET_CLOSE_MIN
} from '../config/index.js'
import { readSnapshot, writeSnapshot } from '../repositories/trendingRepository.js'
import { ensureHolidays, isHoliday } from './holidayService.js'
import { recommendBestSymbols } from './trendingAnalysisService.js'

const NSE_BASE = 'https://www.nseindia.com'
const NSE_REFERER = `${NSE_BASE}/market-data/top-gainers-losers`

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: NSE_REFERER
}

// Public type -> NSE `index` query value. NSE spells losers as "loosers".
const NSE_INDEX = { gainers: 'gainers', losers: 'loosers' }

// Grab a fresh cookie jar from NSE by loading a normal page.
async function getCookies() {
  const res = await fetch(NSE_REFERER, { headers: BROWSER_HEADERS })
  const cookies = res.headers.getSetCookie?.() || []
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

// Fetch an NSE JSON endpoint, trying without cookies first and falling back to
// the cookie handshake only if the direct call fails or returns non-JSON.
async function fetchNseJson(url) {
  // Attempt 1: direct, no cookies (cheap — avoids the heavy HTML page).
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (res.ok) {
      const json = await res.json()
      return json
    }
  } catch {
    /* fall through to cookie handshake */
  }

  // Attempt 2: with a fresh cookie jar (for IPs NSE challenges).
  const cookie = await getCookies()
  const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: cookie } })
  if (!res.ok) {
    throw new Error(`NSE responded with status ${res.status}`)
  }
  return res.json()
}

// Map a raw NSE security row into a clean, UI-friendly object.
function normalizeStock(row) {
  // NSE uses a literal "-" to mean "no value"; treat it as empty.
  const clean = (v) => {
    const s = (v ?? '').toString().trim()
    return s === '-' ? '' : s
  }
  return {
    symbol: row.symbol,
    series: row.series || '',
    ltp: row.ltp ?? null,
    open: row.open_price ?? null,
    high: row.high_price ?? null,
    low: row.low_price ?? null,
    prevClose: row.prev_price ?? null,
    change: row.net_price ?? null,
    percentChange: row.perChange ?? null,
    volume: row.trade_quantity ?? null,
    turnover: row.turnover ?? null,
    // Reason the stock is trending (corporate action / event), e.g.
    // "Dividend - Rs 5.25 Per Share", "Annual General Meeting".
    reason: clean(row.ca_purpose),
    reasonExDate: clean(row.ca_ex_dt)
  }
}

// Fetch the top gainers or losers ("All Securities" bucket) from NSE.
export async function getTrendingStocks(rawType = 'gainers') {
  const type = NSE_INDEX[rawType] ? rawType : 'gainers'

  const json = await fetchNseJson(
    `${NSE_BASE}/api/live-analysis-variations?index=${NSE_INDEX[type]}`
  )

  const bucket = json.allSec
  const rows = Array.isArray(bucket?.data) ? bucket.data : []

  return {
    source: 'live',
    type,
    timestamp: bucket?.timestamp || null,
    count: rows.length,
    stocks: rows.map(normalizeStock)
  }
}

// ---------------------------------------------------------------------------
// IST helpers + daily snapshot with created / modified timestamps
// ---------------------------------------------------------------------------

// Shift a date into IST and expose it via UTC getters so date math is simple.
function toIst(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MIN * 60 * 1000)
}

// Calendar day key (YYYY-MM-DD) in IST, used to detect a new trading day.
function istDayKey(date = new Date()) {
  const d = toIst(date)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

// Minutes since IST midnight, used to gate market hours.
function istMinutes(date = new Date()) {
  const d = toIst(date)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

// Zero-padded IST date key (YYYY-MM-DD) matching the holiday-list format.
function istHolidayKey(date = new Date()) {
  const d = toIst(date)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

// True when NSE is a trading day: Mon–Fri and not a public holiday. The holiday
// check uses whatever is currently loaded in memory (dynamic NSE list or the
// static fallback); call `loadHolidays()` first for the dynamic data.
export function isTradingDay(date = new Date()) {
  const d = toIst(date)
  const day = d.getUTCDay() // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false
  return !isHoliday(istHolidayKey(date))
}

// Preload the dynamic holiday list (NSE API, cached) into memory so the
// synchronous `isTradingDay` / `isMarketOpen` checks are accurate.
export async function loadHolidays(date = new Date()) {
  await ensureHolidays(toIst(date).getUTCFullYear())
}

// True when the NSE market is open (09:00–15:30 IST) on a trading day
// (excludes weekends and public holidays).
export function isMarketOpen(date = new Date()) {
  if (!isTradingDay(date)) return false
  const mins = istMinutes(date)
  return mins >= MARKET_OPEN_MIN && mins <= MARKET_CLOSE_MIN
}

// Fetch live data and merge it into the persisted snapshot. Stocks already in
// the snapshot keep their original `createdAt`; new ones get `createdAt = now`.
// Stocks that were present earlier today but are missing from the latest live
// response are kept, flagged `stale: true`, and pushed to the end of the list.
// At the start of a new trading day the snapshot is reset so every stock's
// `createdAt` marks the 09:00 IST day start.
export async function refreshTrending(rawType = 'gainers') {
  const type = NSE_INDEX[rawType] ? rawType : 'gainers'

  // Never fetch, clear, or start a new day while the market is closed — that is,
  // on a non-trading day (weekend / public holiday) OR on a trading day before
  // the 09:00 IST open and after the 15:30 IST close. NSE still serves the
  // previous session's data outside hours, so refreshing here would wrongly
  // reset the list and start a new day early (before open). Serve the last
  // stored snapshot untouched so the previous (stale) stocks stay visible until
  // the market actually opens.
  await loadHolidays()
  if (!isMarketOpen()) {
    const prev = await readSnapshot(type)
    return {
      source: 'cache',
      marketOpen: false,
      type,
      dayStartedAt: prev?.dayStartedAt || null,
      updatedAt: prev?.updatedAt || null,
      timestamp: prev?.timestamp || null,
      count: prev?.stocks?.length || 0,
      stocks: prev?.stocks || []
    }
  }

  const live = await getTrendingStocks(type)
  const prev = await readSnapshot(type)

  const now = new Date().toISOString()
  const isNewDay = !prev?.dayStartedAt || istDayKey(new Date(prev.dayStartedAt)) !== istDayKey()

  const prevBySymbol = new Map((prev?.stocks || []).map((s) => [s.symbol, s]))
  const liveSymbols = new Set(live.stocks.map((s) => s.symbol))

  // Current live stocks (fresh data). Each stock keeps a `history` array with a
  // snapshot of its % change (and LTP) at every refresh, so the UI can show how
  // the stock moved over the trading day.
  const fresh = live.stocks.map((s) => {
    const existing = isNewDay ? null : prevBySymbol.get(s.symbol)
    const prevHistory = existing?.history || []
    return {
      ...s,
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      stale: false,
      // Preserve a previous AI recommendation (and the time it was made) so a
      // stock stays flagged for the rest of the trading day once picked.
      aiRecommended: existing?.aiRecommended || false,
      aiRecommendedAt: existing?.aiRecommendedAt || null,
      history: [
        ...prevHistory,
        { time: now, percentChange: s.percentChange ?? null, ltp: s.ltp ?? null }
      ]
    }
  })

  // Ask the AI to flag the best 3 genuine opportunities from the fresh list.
  // Existing recommendations are preserved; newly picked stocks are flagged and
  // stamped with the time they were recommended. Best-effort: if the AI is
  // unconfigured or fails, nothing new is flagged and the refresh still succeeds.
  const recommended = new Set(await recommendBestSymbols(type, fresh, 3))
  for (const s of fresh) {
    if (recommended.has(String(s.symbol).toUpperCase())) {
      s.aiRecommended = true
      if (!s.aiRecommendedAt) s.aiRecommendedAt = now
    }
  }

  // Stocks seen earlier today but absent from this refresh: keep last-known
  // values, mark stale, and don't touch `modifiedAt` (data wasn't updated).
  const stale = isNewDay
    ? []
    : (prev?.stocks || [])
        .filter((s) => !liveSymbols.has(s.symbol))
        .map((s) => ({ ...s, stale: true }))

  // Stale rows go to the end of the list.
  const stocks = [...fresh, ...stale]

  const snapshot = {
    type,
    dayStartedAt: isNewDay ? now : prev.dayStartedAt,
    updatedAt: now,
    timestamp: live.timestamp,
    count: stocks.length,
    stocks
  }

  await writeSnapshot(type, snapshot)
  return { source: 'live', marketOpen: isMarketOpen(), ...snapshot }
}

// Read the persisted snapshot for the endpoint. Falls back to a live refresh
// when nothing has been stored yet (first load, or local development where no
// scheduler runs).
export async function readTrending(rawType = 'gainers') {
  const type = NSE_INDEX[rawType] ? rawType : 'gainers'
  const snapshot = await readSnapshot(type)
  // Only serve the cache when it belongs to the current IST trading day.
  // A snapshot from a previous day would otherwise leak yesterday's stocks
  // until the scheduler runs its first refresh.
  const isFromToday =
    snapshot?.dayStartedAt && istDayKey(new Date(snapshot.dayStartedAt)) === istDayKey()
  if (isFromToday && Array.isArray(snapshot.stocks) && snapshot.stocks.length) {
    return { source: 'cache', marketOpen: isMarketOpen(), ...snapshot }
  }

  // No snapshot for today yet. While the market is closed (non-trading day, or a
  // trading day before 09:00 IST open / after 15:30 IST close) we must NOT fetch
  // or start a new day — that would clear the list and repopulate it with the
  // previous session's data, and start "today" early. Serve the last stored
  // snapshot as-is so the previous (stale) stocks stay visible until the market
  // opens; `refreshTrending` only resets and fetches during market hours.
  await loadHolidays()
  if (!isMarketOpen() && snapshot?.stocks?.length) {
    return {
      source: 'cache',
      marketOpen: false,
      type,
      dayStartedAt: snapshot.dayStartedAt || null,
      updatedAt: snapshot.updatedAt || null,
      timestamp: snapshot.timestamp || null,
      count: snapshot.stocks.length,
      stocks: snapshot.stocks
    }
  }

  return refreshTrending(type)
}
