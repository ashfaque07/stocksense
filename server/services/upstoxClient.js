// Upstox order client. All calls go through the static-IP VM relay, which
// forwards `${VM_RELAY_URL}${endpoint}` to Upstox with the bearer token.

import { AUTO_TRADE } from '../config/index.js'

async function relay(endpoint, method, accessToken, payload) {
  if (!AUTO_TRADE.relayUrl || !AUTO_TRADE.relaySecret) {
    throw new Error('VM_RELAY_URL / VM_RELAY_SECRET not configured.')
  }
  const res = await fetch(`${AUTO_TRADE.relayUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'x-secret': AUTO_TRADE.relaySecret
    },
    body: method === 'GET' ? undefined : JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.status === 'error') {
    const msg = data?.errors?.[0]?.message || data?.message || `Upstox HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

// Place an intraday (MIS) market order. Returns the Upstox order id.
export async function placeMarketOrder(accessToken, { instrumentKey, qty, side, tag }) {
  const data = await relay('/v3/order/place', 'POST', accessToken, {
    quantity: qty,
    product: 'I',
    validity: 'DAY',
    price: 0,
    tag: tag || 'stocksense',
    instrument_token: instrumentKey,
    order_type: 'MARKET',
    transaction_type: side,
    disclosed_quantity: 0,
    trigger_price: 0,
    is_amo: false
  })
  const id = data?.data?.order_ids?.[0] || data?.data?.order_id
  if (!id) throw new Error('Upstox did not return an order id.')
  return id
}

// Current state of an order: { status, filledQty, avgPrice, message }. `status` is
// the lower-cased Upstox status (e.g. complete, rejected, cancelled, open).
export async function getOrderStatus(accessToken, orderId) {
  const data = await relay(`/v2/order/details?order_id=${encodeURIComponent(orderId)}`, 'GET', accessToken)
  const o = data?.data || {}
  return {
    status: String(o.status || '').toLowerCase(),
    filledQty: Number(o.filled_quantity) || 0,
    avgPrice: Number(o.average_price) || null,
    message: o.status_message || ''
  }
}

// Best-effort cancel of a pending order.
export async function cancelOrder(accessToken, orderId) {
  await relay(`/v3/order/cancel?order_id=${encodeURIComponent(orderId)}`, 'DELETE', accessToken)
}
