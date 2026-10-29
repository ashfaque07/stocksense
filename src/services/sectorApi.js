// Real-time AI sector rotation analysis via /api/sector-rotation.
// Calls onToken for each chunk of text as it arrives.

import { getSelectedModel } from './modelApi.js'

export async function streamSectorRotation(onToken, signal) {
  let res
  try {
    res = await fetch('/api/sector-rotation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getSelectedModel() }),
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
