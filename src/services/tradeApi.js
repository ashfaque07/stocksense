// Auto-trading API client. Every call needs the admin key (TRADE_ADMIN_KEY).

async function call(path, adminKey, options = {}) {
  const res = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const fetchTrades = (adminKey) => call('/api/trades', adminKey)

export const runTradeCycle = (adminKey) => call('/api/trade-run', adminKey, { method: 'POST', body: '{}' })

export const saveUpstoxToken = (adminKey, token) =>
  call('/api/trade-token', adminKey, { method: 'POST', body: JSON.stringify({ token }) })
