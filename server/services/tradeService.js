// Service layer: auto trading driven by the trending gainers snapshot.
//
// Entry rule: a gainer that is AI-recommended (`aiRecommended`) AND whose
// intraday-screener stage is a BUY stage (default IMMINENT / COILING).
// Sizing: floor(capital / price) shares, MIS (intraday) market order.
// Exits (checked on every run): stop-loss, target, or 15:15 IST square-off.
// Paper mode (default) records trades without calling the broker.

import { AUTO_TRADE, NSE_BASE, NSE_PATHS } from '../config/index.js'
import { fetchNseJson } from './nseClient.js'
import { readTrending, loadHolidays, isMarketOpen, istMinutes, istHolidayKey } from './trendingService.js'
import { analyzeStore, mergeData } from '../../src/utils/intradayScreener.js'
import { placeMarketOrder, getOrderStatus, cancelOrder } from './upstoxClient.js'
import {
  reserveTrade,
  markEntry,
  markExit,
  listOpenTrades,
  countTradesForDate,
  listTrades,
  getSetting,
  setSetting
} from '../repositories/tradeRepository.js'

const TOKEN_KEY = 'upstox_access_token'
const TURNOVER_UNIT = 1e5 // trending turnover is in rupees lakh
const SCORE_THRESHOLD = 10

const round2 = (n) => Math.round(n * 100) / 100
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// After a live BUY, confirm Upstox actually filled it. Returns { filledQty, avgPrice,
// message, unconfirmed }. An order still pending after a few polls is cancelled so we
// never track a position we don't hold. If the status can't be read at all, the order
// is assumed filled (`unconfirmed: true`) because it may well have been.
async function confirmEntryFill(token, orderId, qty) {
  const TERMINAL = ['complete', 'rejected', 'cancelled']
  try {
    let st = null
    for (let i = 0; i < 4; i++) {
      await sleep(1500)
      st = await getOrderStatus(token, orderId)
      if (TERMINAL.includes(st.status)) break
    }
    if (!TERMINAL.includes(st.status)) {
      try {
        await cancelOrder(token, orderId)
      } catch (err) {
        console.error(`[trade] cancel of unfilled entry ${orderId} failed:`, err?.message)
      }
      await sleep(1000)
      st = await getOrderStatus(token, orderId)
    }
    return { ...st, unconfirmed: false }
  } catch (err) {
    console.error(`[trade] could not confirm entry fill for order ${orderId}:`, err?.message)
    return { filledQty: qty, avgPrice: null, message: 'fill unconfirmed', unconfirmed: true }
  }
}

export async function saveAccessToken(token) {
  await setSetting(TOKEN_KEY, token)
}

async function getAccessToken() {
  return (await getSetting(TOKEN_KEY)) || process.env.UPSTOX_ACCESS_TOKEN || null
}

async function getLastPrice(symbol) {
  const json = await fetchNseJson(`${NSE_BASE}${NSE_PATHS.equityInfo}${encodeURIComponent(symbol)}`)
  const quote = json?.equityResponse?.[0]
  // NSE's quote API moved the last price from priceInfo into tradeInfo/orderBook.
  const price = Number(quote?.tradeInfo?.lastPrice ?? quote?.orderBook?.lastPrice ?? quote?.priceInfo?.lastPrice)
  return Number.isFinite(price) && price > 0 ? price : null
}

// Gainers that are AI-recommended and in a BUY stage, best score first.
export async function findSignals() {
  const snap = await readTrending('gainers')
  const day = istHolidayKey(snap?.dayStartedAt ? new Date(snap.dayStartedAt) : new Date())
  if (day !== istHolidayKey()) return [] // snapshot is from a previous session

  // Only regular EQ-series stocks can be traded intraday (MIS). BE/BZ/SM etc. are
  // trade-for-trade or restricted, so they would be rejected or leave a bad position.
  const picks = (snap?.stocks || [])
    .filter((s) => !s.stale && s.aiRecommended && s.isin && s.series === 'EQ')
    .map((s) => ({ ...s, date: day }))
  if (!picks.length) return []

  return analyzeStore(mergeData({}, picks).store, SCORE_THRESHOLD, TURNOVER_UNIT)
    // Skip anything that has hit its upper circuit today (r.uc is set if any
    // snapshot reached the limit): it can't be bought reliably and tends to fade.
    .filter((r) => !r.uc && AUTO_TRADE.buyStages.includes(r.stage))
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ stock: r.s, stage: r.stage, score: r.score, tags: r.tags.map((t) => t[1]) }))
}

async function enter(signal, tradeDate) {
  const { stock } = signal
  const ltp = await getLastPrice(stock.symbol)
  if (!ltp) return { symbol: stock.symbol, action: 'skip', reason: 'no price' }
  if (stock.upperCircuit && ltp >= stock.upperCircuit - 1e-9) {
    return { symbol: stock.symbol, action: 'skip', reason: 'at upper circuit' }
  }

  const qty = Math.floor(AUTO_TRADE.capitalPerTrade / ltp)
  if (qty < 1) return { symbol: stock.symbol, action: 'skip', reason: `price ${ltp} above capital` }

  const mode = AUTO_TRADE.live ? 'live' : 'paper'
  const instrumentKey = `NSE_EQ|${stock.isin}`
  const id = await reserveTrade({
    tradeDate,
    symbol: stock.symbol,
    instrumentKey,
    mode,
    qty,
    entryPrice: ltp,
    slPrice: round2(ltp * (1 - AUTO_TRADE.stopLossPercent / 100)),
    targetPrice: round2(ltp * (1 + AUTO_TRADE.targetPercent / 100)),
    signal: { stage: signal.stage, score: signal.score, tags: signal.tags }
  })
  if (!id) return { symbol: stock.symbol, action: 'skip', reason: 'already traded today' }

  try {
    let orderId = null
    let filledQty = qty
    let fillPrice = ltp
    let note = null
    if (mode === 'live') {
      const token = await getAccessToken()
      if (!token) throw new Error('No Upstox access token set.')
      orderId = await placeMarketOrder(token, { instrumentKey, qty, side: 'BUY', tag: `ss-${id}` })
      const fill = await confirmEntryFill(token, orderId, qty)
      if (!fill.filledQty) {
        throw new Error(`Entry not filled (${fill.status || 'unknown'}): ${fill.message || 'no reason given'}`)
      }
      filledQty = fill.filledQty
      fillPrice = fill.avgPrice || ltp
      if (fill.unconfirmed) note = fill.message
    }
    await markEntry(id, { status: 'OPEN', entryOrderId: orderId, entryPrice: fillPrice, qty: filledQty, error: note })
    return { symbol: stock.symbol, action: 'entered', mode, qty: filledQty, price: fillPrice }
  } catch (err) {
    console.error(`[trade] entry failed for ${stock.symbol}:`, err?.message)
    await markEntry(id, { status: 'REJECTED', error: err?.message })
    return { symbol: stock.symbol, action: 'error', error: err?.message }
  }
}

async function exit(trade, ltp, reason) {
  let orderId = null
  let error = null
  try {
    if (trade.mode === 'live') {
      const token = await getAccessToken()
      if (!token) throw new Error('No Upstox access token set.')
      orderId = await placeMarketOrder(token, {
        instrumentKey: trade.instrument_key,
        qty: trade.qty,
        side: 'SELL',
        tag: `ss-${trade.id}`
      })
    }
  } catch (err) {
    // Leave the trade OPEN so the next run retries the exit.
    console.error(`[trade] exit failed for ${trade.symbol}:`, err?.message)
    return { symbol: trade.symbol, action: 'error', error: err?.message }
  }
  const pnl = round2((ltp - Number(trade.entry_price)) * trade.qty)
  await markExit(trade.id, { exitPrice: ltp, exitOrderId: orderId, reason, pnl, error })
  return { symbol: trade.symbol, action: 'exited', reason, price: ltp, pnl }
}

// One cycle: manage exits for open trades, then (before square-off) enter new
// ones. Safe to run every minute.
export async function runCycle() {
  await loadHolidays()
  if (!isMarketOpen()) return { skipped: 'market closed', results: [] }

  const mins = istMinutes()
  const tradeDate = istHolidayKey()
  const results = []

  for (const trade of await listOpenTrades()) {
    try {
      const ltp = await getLastPrice(trade.symbol)
      if (!ltp && mins < AUTO_TRADE.squareOffMin) continue
      const px = ltp || Number(trade.entry_price)
      let reason = null
      if (mins >= AUTO_TRADE.squareOffMin) reason = 'SQUAREOFF'
      else if (px <= Number(trade.sl_price)) reason = 'STOP_LOSS'
      else if (px >= Number(trade.target_price)) reason = 'TARGET'
      if (reason) results.push(await exit(trade, px, reason))
    } catch (err) {
      console.error(`[trade] exit check failed for ${trade.symbol}:`, err?.message)
      results.push({ symbol: trade.symbol, action: 'error', error: err?.message })
    }
  }

  if (mins >= AUTO_TRADE.entryStartMin && mins < AUTO_TRADE.squareOffMin) {
    let slots = AUTO_TRADE.maxPositions - (await countTradesForDate(tradeDate))
    if (slots > 0) {
      for (const signal of await findSignals()) {
        if (slots <= 0) break
        const r = await enter(signal, tradeDate)
        results.push(r)
        if (r.action === 'entered') slots--
      }
    }
  }

  return { mode: AUTO_TRADE.live ? 'live' : 'paper', results }
}

export async function getTradeStatus() {
  const trades = await listTrades()
  const closed = trades.filter((t) => t.status === 'CLOSED')
  return {
    mode: AUTO_TRADE.live ? 'live' : 'paper',
    enabled: AUTO_TRADE.enabled,
    config: {
      capitalPerTrade: AUTO_TRADE.capitalPerTrade,
      maxPositions: AUTO_TRADE.maxPositions,
      stopLossPercent: AUTO_TRADE.stopLossPercent,
      targetPercent: AUTO_TRADE.targetPercent,
      buyStages: AUTO_TRADE.buyStages
    },
    totalPnl: round2(closed.reduce((sum, t) => sum + Number(t.pnl || 0), 0)),
    trades
  }
}
