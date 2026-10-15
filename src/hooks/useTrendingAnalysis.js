// Hook: runs the AI "best pick" analysis over the current trending stocks list.

import { useRef, useState } from 'react'
import { streamTrendingAnalysis } from '../services/trendingApi.js'

export function useTrendingAnalysis() {
  const [result, setResult] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  async function analyze(type, stocks) {
    if (!Array.isArray(stocks) || !stocks.length) return

    // Cancel any in-flight analysis.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError(null)
    setStreaming(true)
    setResult({ provider: 'gemini', summary: '' })

    try {
      const final = await streamTrendingAnalysis(
        type,
        stocks,
        (chunk) => {
          setResult((prev) => ({ ...prev, summary: (prev?.summary || '') + chunk }))
        },
        controller.signal
      )
      setResult(final)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        setResult(null)
      }
    } finally {
      setStreaming(false)
    }
  }

  function reset() {
    abortRef.current?.abort()
    setResult(null)
    setError(null)
    setStreaming(false)
  }

  return { result, streaming, error, analyze, reset }
}
