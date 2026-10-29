// Hook: runs real-time AI sector rotation analysis for Indian equities.

import { useRef, useState } from 'react'
import { streamSectorRotation } from '../services/sectorApi.js'

export function useSectorRotation() {
  const [result, setResult] = useState(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  async function analyze() {
    // Cancel any in-flight analysis.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError(null)
    setStreaming(true)
    setResult({ provider: 'gemini', summary: '' })

    try {
      const final = await streamSectorRotation(
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
