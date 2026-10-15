// Service: resolves NSE trading holidays dynamically from the NSE
// holiday-master API, cached per year (in-memory + repository), with the
// static NSE_HOLIDAYS list as a fallback when the API is unavailable.

import { NSE_HOLIDAYS } from '../config/index.js'
import { readHolidays, writeHolidays } from '../repositories/holidayRepository.js'

const NSE_BASE = 'https://www.nseindia.com'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `${NSE_BASE}/`
}

// Refresh the cached holiday list at most once per day.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// In-memory holiday set per year: { [year]: Set<'YYYY-MM-DD'> }
const memory = new Map()

// "15-Jan-2026" -> "2026-01-15"
function toIsoDate(tradingDate) {
  const d = new Date(tradingDate)
  if (Number.isNaN(d.getTime())) return null
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function getCookies() {
  const res = await fetch(`${NSE_BASE}/`, { headers: BROWSER_HEADERS })
  const cookies = res.headers.getSetCookie?.() || []
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

// Fetch an NSE JSON endpoint, trying without cookies first and falling back to
// the cookie handshake only if the direct call fails.
async function fetchNseJson(url) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (res.ok) return await res.json()
  } catch(err) {
    /* fall through to cookie handshake */
    console.error('fetchNseJson: failed without cookies, err=', err)
  }

  const cookie = await getCookies()
  const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: cookie } })
  if (!res.ok) throw new Error(`NSE holiday API responded with status ${res.status}`)
  return res.json()
}

// Fetch the Capital Market (CM) trading holidays for the current year from NSE.
async function fetchHolidaysFromNse() {
  const json = await fetchNseJson(`${NSE_BASE}/api/holiday-master?type=trading`)
  const rows = Array.isArray(json?.CM) ? json.CM : []
  return rows
    .map((r) => toIsoDate(r.tradingDate))
    .filter(Boolean)
}

// Static-fallback dates that fall in the given year.
function staticDatesForYear(year) {
  const prefix = `${year}-`
  return [...NSE_HOLIDAYS].filter((d) => d.startsWith(prefix))
}

// Ensure the holiday set for `year` is loaded into memory. Tries the repository
// cache first, refreshes from NSE when stale/missing, and always merges the
// static fallback so we never regress to fewer holidays than we know about.
export async function ensureHolidays(year = new Date().getFullYear()) {
  if (memory.has(year)) return memory.get(year)

  let dates = null
  try {
    const cached = await readHolidays(year)
    const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
    if (cached && fresh && Array.isArray(cached.dates)) {
      dates = cached.dates
    }
  } catch {
    /* fall through to fetch */
  }

  if (!dates) {
    try {
      const fetched = await fetchHolidaysFromNse()
      dates = fetched
      await writeHolidays(year, { fetchedAt: new Date().toISOString(), dates })
    } catch (err) {
      console.error('Holiday fetch failed, using static fallback:', err.message)
      dates = staticDatesForYear(year)
    }
  }

  const set = new Set([...dates, ...staticDatesForYear(year)])
  memory.set(year, set)
  return set
}

// Synchronous check against whatever is currently in memory, falling back to
// the static list. Call `ensureHolidays()` beforehand for dynamic data.
export function isHoliday(isoDate, year = Number(isoDate.slice(0, 4))) {
  const set = memory.get(year)
  if (set) return set.has(isoDate)
  return NSE_HOLIDAYS.has(isoDate)
}
