// API client for live trending stocks (top gainers / losers) from the proxy.

import { getSelectedModel } from './modelApi.js'

export async function fetchTrending(type = 'gainers', force = false) {
  const params = new URLSearchParams({ type })
  if (force) params.set('refresh', '1')
  const res = await fetch(`/api/trending?${params.toString()}`, { cache: 'no-store' })
  return res.json()
}

// Stream an AI "best pick" analysis over the trending stocks list via
// /api/analyze-trending. Calls onToken for each chunk of text as it arrives.
export async function streamTrendingAnalysis(type, stocks, onToken, signal) {
  let res
  try {
    res = await fetch('/api/analyze-trending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, stocks, model: getSelectedModel() }),
      signal
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new Error(`Network error: ${err.message}`)
  }

  if (!res.ok || !res.body) {
    let detail = `status ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) detail = data.error
    } catch {
      /* non-JSON body */
    }
    throw new Error(detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    text += chunk
    onToken(chunk)
  }

  return { provider: 'gemini', summary: text }
}
