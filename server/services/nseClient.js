// Shared NSE (National Stock Exchange of India) HTTP client.
//
// Centralises the browser-like headers, the cookie handshake, and the resilient
// JSON fetcher so every service (trending, results, holidays, and any future
// one) uses the same logic. Import `fetchNseJson` from here instead of
// re-implementing NSE requests.

import { NSE_BASE, NSE_PATHS } from '../config/index.js'

// NSE challenges non-browser clients, so mimic a real browser.
export const NSE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `${NSE_BASE}${NSE_PATHS.home}`
}

// Grab a fresh cookie jar from NSE by loading a normal page.
async function getCookies() {
  const res = await fetch(`${NSE_BASE}${NSE_PATHS.home}`, { headers: NSE_HEADERS })
  const cookies = res.headers.getSetCookie?.() || []
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

// Fetch an NSE JSON endpoint, trying without cookies first (cheap — avoids the
// heavy HTML page) and falling back to the cookie handshake only if the direct
// call fails or returns a non-OK status (for IPs NSE challenges).
export async function fetchNseJson(url) {
  // Attempt 1: direct, no cookies.
  try {
    const res = await fetch(url, { headers: NSE_HEADERS })
    if (res.ok) return await res.json()
  } catch {
    /* fall through to cookie handshake */
  }

  // Attempt 2: with a fresh cookie jar.
  const cookie = await getCookies()
  const res = await fetch(url, { headers: { ...NSE_HEADERS, Cookie: cookie } })
  if (!res.ok) {
    throw new Error(`NSE responded with status ${res.status}`)
  }
  return res.json()
}
