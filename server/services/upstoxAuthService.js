// Service layer: daily Upstox access-token refresh using Upstox's TOTP login
// (POST /v2/totp-login/authorization/token). Access tokens expire at 03:30 IST
// every day, so the existing trade-run cron calls `ensureFreshToken()` and this
// generates a new one (at most once per IST day) and stores it for trading.
// Requires TOTP to be enabled on the Upstox account.

import { createHmac } from 'node:crypto'
import { AUTO_TRADE } from '../config/index.js'
import { saveAccessToken } from './tradeService.js'
import { istHolidayKey } from './trendingService.js'
import { getSetting, setSetting } from '../repositories/tradeRepository.js'

const DAY_KEY = 'upstox_token_day'
const ATTEMPT_KEY = 'upstox_token_attempt'
const RETRY_MS = 10 * 60 * 1000 // after a failure, retry at most every 10 minutes

const TOTP_URL = 'https://api.upstox.com/v2/totp-login/authorization/token'
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[\s=-]/g, '')
  let bits = ''
  for (const ch of clean) {
    const v = BASE32.indexOf(ch)
    if (v < 0) throw new Error('UPSTOX_TOTP_SECRET is not valid base32.')
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

// RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits).
export function generateTotp(secret, nowMs = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / 30)))
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

export async function refreshUpstoxToken() {
  const { upstoxApiKey, upstoxPin, upstoxTotpSecret } = AUTO_TRADE
  if (!upstoxApiKey || !upstoxPin || !upstoxTotpSecret) {
    throw new Error('Set UPSTOX_API_KEY, UPSTOX_PIN and UPSTOX_TOTP_SECRET to auto-refresh the token.')
  }

  const res = await fetch(TOTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': upstoxApiKey },
    body: JSON.stringify({ totp: generateTotp(upstoxTotpSecret), pin: upstoxPin }),
    signal: AbortSignal.timeout(15000)
  })
  const data = await res.json().catch(() => ({}))
  const token = data?.access_token || data?.data?.access_token
  if (!res.ok || !token) {
    const msg = data?.errors?.[0]?.message || data?.message || `Upstox HTTP ${res.status}`
    throw new Error(msg)
  }
  await saveAccessToken(token)
  return { saved: true }
}

// Called on every trade-run tick. Refreshes the token once per IST day, only in
// live mode with credentials configured. Never throws, so trading isn't blocked.
export async function ensureFreshToken() {
  const { live, upstoxApiKey, upstoxPin, upstoxTotpSecret } = AUTO_TRADE
  if (!live || !upstoxApiKey || !upstoxPin || !upstoxTotpSecret) return null
  try {
    const today = istHolidayKey()
    if ((await getSetting(DAY_KEY)) === today) return null
    const lastAttempt = Number(await getSetting(ATTEMPT_KEY)) || 0
    if (Date.now() - lastAttempt < RETRY_MS) return null
    await setSetting(ATTEMPT_KEY, String(Date.now()))
    const out = await refreshUpstoxToken()
    await setSetting(DAY_KEY, today)
    return out
  } catch (err) {
    console.error('[upstox-auth] token refresh failed:', err?.message)
    return { saved: false, error: err?.message }
  }
}
