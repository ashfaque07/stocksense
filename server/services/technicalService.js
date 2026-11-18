// Computes technical indicators for an NSE symbol from Yahoo Finance daily
// candles. Best-effort: any failure returns null so the forecast still runs.

import { YAHOO_CHART_URL } from '../config/index.js'

const round = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)

function sma(values, period) {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

// Exponential moving average series (seeded with the first value).
function emaSeries(values, period) {
  const k = 2 / (period + 1)
  const out = [values[0]]
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k))
  return out
}

// Wilder-smoothed RSI.
function rsi(closes, period = 14) {
  if (closes.length <= period) return null
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= period
  loss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
}

// Wilder-smoothed Average True Range.
function atr(highs, lows, closes, period = 14) {
  if (closes.length <= period) return null
  const tr = []
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < tr.length; i++) value = (value * (period - 1) + tr[i]) / period
  return value
}

export async function getTechnicals(symbol) {
  try {
    const res = await fetch(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}.NS?range=1y&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) throw new Error(`Yahoo chart responded with status ${res.status}`)
    const json = await res.json()
    const q = json?.chart?.result?.[0]?.indicators?.quote?.[0]
    if (!q) return null

    // Keep rows where every field is present.
    const rows = q.close
      .map((c, i) => ({ c, h: q.high[i], l: q.low[i], v: q.volume[i] }))
      .filter((r) => [r.c, r.h, r.l, r.v].every((x) => Number.isFinite(x)))
    if (rows.length < 30) return null

    const closes = rows.map((r) => r.c)
    const highs = rows.map((r) => r.h)
    const lows = rows.map((r) => r.l)
    const volumes = rows.map((r) => r.v)
    const last = closes[closes.length - 1]

    const ema12 = emaSeries(closes, 12)
    const ema26 = emaSeries(closes, 26)
    const macdLine = ema12.map((v, i) => v - ema26[i])
    const signal = emaSeries(macdLine, 9)

    const ret = (days) =>
      closes.length > days ? round(((last / closes[closes.length - 1 - days]) - 1) * 100) : null
    const avgVol = sma(volumes.slice(0, -1), 20)

    return {
      ltp: round(last),
      ema20: round(emaSeries(closes, 20).at(-1)),
      sma50: round(sma(closes, 50)),
      sma200: round(sma(closes, 200)),
      rsi14: round(rsi(closes)),
      macd: round(macdLine.at(-1)),
      macdSignal: round(signal.at(-1)),
      atr14: round(atr(highs, lows, closes)),
      volumeRatio: avgVol ? round(volumes.at(-1) / avgVol) : null,
      return5d: ret(5),
      return1m: ret(21)
    }
  } catch (err) {
    console.error(`[technicals] fetch failed for ${symbol}:`, err?.message)
    return null
  }
}
