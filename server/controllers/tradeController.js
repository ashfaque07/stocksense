// Controller: auto-trading endpoints. All of them place or reveal real trading
// data, so every request must carry the TRADE_ADMIN_KEY in `x-admin-key`.
//
// `handleTradeRequest` is transport-agnostic so both the local Node server and
// the Netlify function can share it. It returns { status, body }.

import { timingSafeEqual } from 'node:crypto'
import { AUTO_TRADE } from '../config/index.js'
import { getTradeStatus, runCycle, saveAccessToken } from '../services/tradeService.js'

function authorized(provided) {
  const expected = Buffer.from(AUTO_TRADE.adminKey)
  const given = Buffer.from(String(provided || ''))
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given)
}

// kind: 'status' | 'run' | 'token'
export async function handleTradeRequest(kind, { method, adminKey, body }) {
  if (!AUTO_TRADE.adminKey) {
    return { status: 503, body: { error: 'Set TRADE_ADMIN_KEY to use trading endpoints.' } }
  }
  if (!authorized(adminKey)) return { status: 401, body: { error: 'Unauthorized.' } }

  try {
    if (kind === 'status') {
      if (method !== 'GET') return { status: 405, body: { error: 'Method not allowed.' } }
      return { status: 200, body: await getTradeStatus() }
    }
    if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } }
    if (kind === 'run') return { status: 200, body: await runCycle() }

    const token = String(body?.token || '').trim()
    if (!token) return { status: 400, body: { error: 'Missing token.' } }
    await saveAccessToken(token)
    return { status: 200, body: { saved: true } }
  } catch (err) {
    console.error('[trade] request failed:', err?.message)
    return { status: 502, body: { error: err?.message || 'Trade request failed.' } }
  }
}

// Adapter for the local Node http server.
export async function handleTradeNode(kind, req, res) {
  let body = {}
  if (req.method === 'POST') {
    let raw = ''
    for await (const chunk of req) raw += chunk
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
      return
    }
  }
  const out = await handleTradeRequest(kind, { method: req.method, adminKey: req.headers['x-admin-key'], body })
  res.statusCode = out.status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(out.body))
}
