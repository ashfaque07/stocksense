// Service layer: rule-based verdict for a report stock.
//
// Turns the stored numbers (circuit, market cap, turnover, volume, price
// action) into short plain statements plus one category label, so stocks can
// be grouped at a glance. Pure and deterministic: no AI or network calls.

import { VERDICT_THRESHOLDS as T } from '../config/index.js'

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const pct = (a, b) => (a !== null && b ? ((a - b) / b) * 100 : null)

// Market cap tier from the stored rupee value.
function capTier(marketCap) {
  const cr = marketCap === null ? null : marketCap / 1e7
  if (cr === null) return null
  if (cr < T.marketCapCr.micro) return 'micro'
  if (cr < T.marketCapCr.small) return 'small'
  if (cr < T.marketCapCr.large) return 'mid'
  return 'large'
}

// Liquidity tier from turnover (₹ lakh) and volume (shares).
function activityTier(turnover, volume) {
  if (turnover === null && volume === null) return null
  if (turnover !== null && turnover >= T.turnoverLakh.veryHigh) return 'veryHigh'
  if ((turnover !== null && turnover >= T.turnoverLakh.high) || (volume !== null && volume >= T.volume.high)) return 'high'
  if ((turnover !== null && turnover < T.turnoverLakh.low) || (volume !== null && volume < T.volume.low)) return 'low'
  return 'normal'
}

const CAP_TEXT = {
  micro: ['Very low market cap (micro cap)', 'negative'],
  small: ['Low market cap (small cap)', 'neutral'],
  mid: ['Mid market cap', 'neutral'],
  large: ['High market cap (large cap)', 'positive']
}

const ACTIVITY_TEXT = {
  veryHigh: ['Very high turnover and volume', 'positive'],
  high: ['High turnover / volume', 'positive'],
  low: ['Low turnover / volume (thin liquidity)', 'negative']
}

// Returns { category, summary, statements: [{ code, text, tone }] }.
export function buildVerdict(stock) {
  const ltp = num(stock.ltp)
  const open = num(stock.open)
  const high = num(stock.high)
  const low = num(stock.low)
  const prevClose = num(stock.prevClose)
  const vwap = num(stock.vwap)
  const upper = num(stock.upperCircuit)
  const turnover = num(stock.turnover)
  const volume = num(stock.volume)
  const marketCap = num(stock.marketCap)
  const change = num(stock.percentChange)

  const statements = []
  const add = (code, text, tone = 'neutral') => statements.push({ code, text, tone })

  // Circuit
  let circuit = null
  if (upper !== null && ltp !== null) {
    if (ltp >= upper) circuit = 'hit'
    else if (high !== null && high >= upper) circuit = 'touched'
    else if (((upper - ltp) / upper) * 100 <= T.nearCircuitPercent) circuit = 'near'
  }
  if (circuit === 'hit') add('UPPER_CIRCUIT', 'Hit the upper circuit', 'positive')
  else if (circuit === 'touched') add('UPPER_CIRCUIT_SLIP', 'Touched the upper circuit but slipped back', 'neutral')
  else if (circuit === 'near') add('NEAR_UPPER_CIRCUIT', 'Trading close to the upper circuit', 'positive')

  // Market cap
  const cap = capTier(marketCap)
  if (cap) add(`CAP_${cap.toUpperCase()}`, CAP_TEXT[cap][0], CAP_TEXT[cap][1])

  // Turnover / volume
  const activity = activityTier(turnover, volume)
  if (activity && ACTIVITY_TEXT[activity]) add(`ACTIVITY_${activity.toUpperCase()}`, ...ACTIVITY_TEXT[activity])

  // Turnover relative to market cap (turnover is ₹ lakh, market cap is ₹)
  if (turnover !== null && marketCap) {
    const churn = ((turnover * 1e5) / marketCap) * 100
    if (churn >= T.churnPercent) add('HEAVY_CHURN', `Heavy churn: ${churn.toFixed(1)}% of market cap traded in a day`, 'positive')
  }

  // Price action
  if (change !== null && change >= T.strongMovePercent) add('STRONG_RALLY', `Strong rally of ${change.toFixed(2)}%`, 'positive')
  const gap = pct(open, prevClose)
  if (gap !== null && gap >= T.gapPercent) add('GAP_UP', `Gap-up open (+${gap.toFixed(1)}%)`, 'positive')
  if (high !== null && low !== null && ltp !== null && high > low) {
    const fromHighPct = ((high - ltp) / (high - low)) * 100
    if (fromHighPct <= T.nearHighRangePercent) add('NEAR_DAY_HIGH', 'Closed near the day high', 'positive')
    else if (fromHighPct >= 50) add('FADED_FROM_HIGH', 'Faded sharply from the day high', 'negative')
  }
  if (vwap !== null && ltp !== null) {
    if (ltp > vwap) add('ABOVE_VWAP', 'Trading above VWAP (buyers in control)', 'positive')
    else if (ltp < vwap) add('BELOW_VWAP', 'Trading below VWAP (profit booking)', 'negative')
  }
  if (stock.aiRecommended) add('AI_PICK', 'Recommended by AI during the day', 'positive')

  // Category (first match wins)
  const lowCap = cap === 'micro' || cap === 'small'
  const highActivity = activity === 'high' || activity === 'veryHigh'
  let category = 'Regular Mover'
  if (circuit === 'hit') category = lowCap ? 'Low-cap Upper Circuit' : 'Upper Circuit'
  else if (lowCap && highActivity) category = 'Low-cap Momentum'
  else if (cap === 'large' && highActivity) category = 'Large-cap Leader'
  else if (highActivity) category = 'High-activity Mover'
  else if (activity === 'low') category = 'Thin Mover (Low Liquidity)'

  const parts = statements
    .filter((s) => s.code.startsWith('UPPER_CIRCUIT') || s.code.startsWith('CAP_') || s.code.startsWith('ACTIVITY_'))
    .map((s) => s.text.charAt(0).toLowerCase() + s.text.slice(1))
  const summary = parts.length ? `${stock.symbol}: ${parts.join('; ')}.` : `${stock.symbol}: not enough data for a verdict.`

  return { category, summary, statements }
}

// Attach a computed `verdict` to each record (not persisted, so thresholds can
// change without rewriting stored data).
export function withVerdicts(records) {
  return records.map((r) => ({ ...r, verdict: buildVerdict(r) }))
}
