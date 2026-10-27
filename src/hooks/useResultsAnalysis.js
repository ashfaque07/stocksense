// Hook: runs the AI "what to expect" preview for a single upcoming result.

import { useRef, useState } from 'react'
import { streamResultsAnalysis } from '../services/resultsApi.js'

export function useResultsAnalysis() {
  const [result, setResult] = useState(null)
  const [stock, setStock] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  async function analyze(target) {
    if (!target?.symbol) return

    // Cancel any in-flight analysis.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStock(target)
    setError(null)
    setStreaming(true)
    setResult({ summary: '' })

    try {
      const final = await streamResultsAnalysis(
        target,
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
    setStock(null)
    setError(null)
    setStreaming(false)
  }

  return { result, stock, streaming, error, analyze, reset }
}
