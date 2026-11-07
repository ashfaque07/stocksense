// Service layer: fetches a listed company's recent quarterly financial results
// so the UI can show the last two quarters when a user opens an
// upcoming-results row.
//
// Primary source is Yahoo Finance's fundamentals-timeseries API, which exposes
// up-to-date quarterly figures (revenue, pre-tax/net income, EPS) keyed by the
// quarter-end date. We fall back to NSE's results-comparision feed only if
// Yahoo is unavailable, since that NSE endpoint can lag by several quarters.

import { stripTags } from '../utils/html.js'
import { fetchNseJson } from './nseClient.js'
import { NSE_BASE, NSE_PATHS, YAHOO_TIMESERIES_URL } from '../config/index.js'

// How many recent quarterly results to show in the stock-details view.
const QUARTERS_TO_SHOW = 4

const COMPARE_URL = (symbol) =>
  `${NSE_BASE}${NSE_PATHS.resultsComparision}?symbol=${encodeURIComponent(symbol)}`

const YF_BASE = YAHOO_TIMESERIES_URL
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

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, QUARTERS_TO_SHOW)
  if (!dates.length) return null

  const quarters = dates.map((endIso) => {
    const metric = byDate.get(endIso)
    return {
      periodFrom: quarterStart(endIso),
      periodTo: isoToNseDay(endIso),
      revenue: toCroreFromRupees(metric.quarterlyTotalRevenue),
      profitBeforeTax: toCroreFromRupees(metric.quarterlyPretaxIncome),
      netProfit: toCroreFromRupees(metric.quarterlyNetIncome),
      eps: num(metric.quarterlyBasicEPS)
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
  return {
    periodFrom: stripTags(row?.re_from_dt),
    periodTo: stripTags(row?.re_to_dt),
    revenue: toCrore(row?.re_net_sale),
    profitBeforeTax: toCrore(row?.re_pro_loss_bef_tax),
    netProfit: toCrore(row?.re_net_profit),
    eps: num(row?.re_basic_eps_for_cont_dic_opr ?? row?.re_diluted_eps)
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
    quarters: rows.slice(0, QUARTERS_TO_SHOW).map(normalizeQuarter)
  }
}

// Fetch live market details for a symbol from NSE's GetQuoteApi endpoint
// (same source the Trending view uses). We only expose LTP, market cap and the
// 52-week range. Best-effort — any failure returns null so the detail modal
// still renders the quarterly results.
async function fetchLiveQuote(symbol) {
  try {
    const json = await fetchNseJson(`${NSE_BASE}${NSE_PATHS.equityInfo}${encodeURIComponent(symbol)}`);
    const resp = json?.equityResponse?.[0]
    if (!resp) return null
    const p = resp.priceInfo || {}
    const t = resp.tradeInfo || {}
    const toNum = (v) => {
      const n = Number(String(v ?? '').replace(/,/g, '').trim())
      return Number.isFinite(n) ? n : null
    }
    return {
      ltp: toNum(t.lastPrice),
      marketCap: toNum(t.totalMarketCap),
      yearHigh: toNum(p.yearHigh),
      yearLow: toNum(p.yearLow)
    }
  } catch (err) {
    console.error(`[results-detail] live quote fetch failed for ${symbol}:`, err?.message)
    return null
  }
}

// Fetch stock details + the last two quarterly financial results for a symbol,
// preferring Yahoo Finance and falling back to NSE.
export async function getResultsDetail(symbol) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) throw new Error('Missing stock symbol.')

  // Fetch the live NSE quote alongside the quarterly results.
  const quotePromise = fetchLiveQuote(sym)

  let detail
  try {
    const yf = await fromYahoo(sym)
    if (yf?.quarters?.length) detail = yf
  } catch (err) {
    console.error('[results-detail] Yahoo failed, falling back to NSE:', err.message)
  }

  if (!detail) detail = await fromNse(sym)

  return { ...detail, quote: (await quotePromise) || null }
}
