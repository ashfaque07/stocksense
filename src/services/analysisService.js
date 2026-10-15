// Real-time AI IPO analysis via the server's /api/analyze endpoint.
// Calls onToken for each chunk of text as it arrives.

import { getSelectedModel } from './modelApi.js'

export async function streamAnalysis(ipo, onToken, signal) {
  let res
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ipo, model: getSelectedModel() }),
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

  return { provider: 'gemini', score: null, verdict: null, summary: text }
}
