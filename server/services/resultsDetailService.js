// Service layer: fetches a listed company's recent quarterly financial results
// so the UI can show the last two quarters when a user opens an
// upcoming-results row.
//
// Primary source is Yahoo Finance's fundamentals-timeseries API, which exposes
// up-to-date quarterly figures (revenue, pre-tax/net income, EPS) keyed by the
// quarter-end date. We fall back to NSE's results-comparision feed only if
// Yahoo is unavailable, since that NSE endpoint can lag by several quarters.

import { stripTags } from '../utils/html.js'
import { fetchNseJson } from './resultsService.js'

const NSE_BASE = 'https://www.nseindia.com'
const COMPARE_URL = (symbol) =>
  `${NSE_BASE}/api/results-comparision?symbol=${encodeURIComponent(symbol)}`

const YF_BASE =
  'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries'
const YF_TYPES = [
  'quarterlyTotalRevenue',
  'quarterlyPretaxIncome',
  'quarterlyNetIncome',
  'quarterlyBasicEPS'
]
const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/json'
}

// Yahoo reports figures in absolute rupees; convert to ₹ crore for display.
function toCroreFromRupees(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n / 1e7
}

// NSE reports financial figures in ₹ lakhs; convert to ₹ crore for display.
function toCrore(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n / 100
}

// Keep a numeric string (e.g. EPS) as-is, or null when absent.
function num(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// Format an ISO day (YYYY-MM-DD) as NSE-style "30-SEP-2026", which the UI
// already knows how to render.
const MONTH_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
]
function isoToNseDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return ''
  const month = MONTH_ABBR[Number(m[2]) - 1] || ''
  return `${m[3]}-${month}-${m[1]}`
}

// Derive the quarter-start label from a quarter-end date (first day of the
// month three months earlier).
function quarterStart(endIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(endIso || ''))
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 2)
  return isoToNseDay(d.toISOString())
}

// Fetch the last two quarterly results from Yahoo Finance. Returns null when no
// usable data is found so the caller can fall back to NSE.
async function fromYahoo(symbol) {
  const ticker = `${symbol}.NS`
  const period1 = Math.floor(Date.now() / 1000) - 3 * 365 * 24 * 3600
  const period2 = Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  const url =
    `${YF_BASE}/${encodeURIComponent(ticker)}?symbol=${encodeURIComponent(ticker)}` +
    `&type=${YF_TYPES.join(',')}&period1=${period1}&period2=${period2}`

  const res = await fetch(url, { headers: YF_HEADERS })
  if (!res.ok) throw new Error(`Yahoo responded with status ${res.status}`)
  const json = await res.json()
  const series = json?.timeseries?.result
  if (!Array.isArray(series) || !series.length) return null

  // Collect each metric series keyed by quarter-end date.
  const byDate = new Map()
  for (const s of series) {
    const type = s?.meta?.type?.[0]
    const points = s?.[type]
    if (!type || !Array.isArray(points)) continue
    for (const p of points) {
      const date = p?.asOfDate
      const value = p?.reportedValue?.raw
      if (!date || value === undefined || value === null) continue
      // Some Indian companies with US ADRs (e.g. INFY) are reported by Yahoo in
      // USD. We only trust INR figures here; bail out so the caller falls back
      // to NSE rather than showing mis-scaled numbers.
      const currency = p?.currencyCode || p?.reportedValue?.currencyCode
      if (currency && currency !== 'INR') return null
      if (!byDate.has(date)) byDate.set(date, {})
      byDate.get(date)[type] = value
    }
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 2)
  if (!dates.length) return null

  const quarters = dates.map((endIso) => {
    const metric = byDate.get(endIso)
    return {
      periodFrom: quarterStart(endIso),
      periodTo: isoToNseDay(endIso),
      revenue: toCroreFromRupees(metric.quarterlyTotalRevenue),
      totalIncome: null,
      profitBeforeTax: toCroreFromRupees(metric.quarterlyPretaxIncome),
      netProfit: toCroreFromRupees(metric.quarterlyNetIncome),
      eps: num(metric.quarterlyBasicEPS),
      audited: 'Un-Audited',
      reportedOn: ''
    }
  })

  return {
    source: 'yahoo',
    timestamp: new Date().toISOString(),
    symbol,
    faceValue: null,
    quarters
  }
}

// Map a raw NSE results-comparision row into a clean quarter summary.
function normalizeQuarter(row) {
  const resType = stripTags(row?.re_res_type)
  return {
    periodFrom: stripTags(row?.re_from_dt),
    periodTo: stripTags(row?.re_to_dt),
    revenue: toCrore(row?.re_net_sale),
    totalIncome: toCrore(row?.re_total_inc),
    profitBeforeTax: toCrore(row?.re_pro_loss_bef_tax),
    netProfit: toCrore(row?.re_net_profit),
    eps: num(row?.re_basic_eps_for_cont_dic_opr ?? row?.re_diluted_eps),
    audited: resType === 'A' ? 'Audited' : 'Un-Audited',
    reportedOn: stripTags(row?.re_create_dt)
  }
}

// Fallback: fetch the last two quarterly financial results from NSE.
async function fromNse(symbol) {
  const json = await fetchNseJson(COMPARE_URL(symbol))
  const rows = Array.isArray(json?.resCmpData) ? json.resCmpData : []
  return {
    source: 'nse',
    timestamp: new Date().toISOString(),
    symbol,
    faceValue: rows.length ? num(rows[0]?.re_face_val) : null,
    quarters: rows.slice(0, 2).map(normalizeQuarter)
  }
}

// Fetch stock details + the last two quarterly financial results for a symbol,
// preferring Yahoo Finance and falling back to NSE.
export async function getResultsDetail(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) throw new Error('Missing stock symbol.')

  try {
    const yf = await fromYahoo(sym)
    if (yf?.quarters?.length) return yf
  } catch (err) {
    console.error('[results-detail] Yahoo failed, falling back to NSE:', err.message)
  }

  return fromNse(sym)
}
