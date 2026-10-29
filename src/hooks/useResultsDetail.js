// Hook: loads stock details + the last two quarterly results for one symbol
// when a user opens an upcoming-results row.

import { useCallback, useRef, useState } from 'react'
import { fetchResultsDetail } from '../services/resultsApi.js'

export function useResultsDetail() {
  const [stock, setStock] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const reqRef = useRef(0)

  const open = useCallback(async (target) => {
    if (!target?.symbol) return
    const reqId = ++reqRef.current
    setStock(target)
    setDetail(null)
    setError(null)
    setLoading(true)
    try {
      const data = await fetchResultsDetail(target.symbol)
      if (reqId !== reqRef.current) return
      if (data.error) throw new Error(data.error)
      setDetail(data)
    } catch (err) {
      if (reqId === reqRef.current) setError(err.message)
    } finally {
      if (reqId === reqRef.current) setLoading(false)
    }
  }, [])

  const close = useCallback(() => {
    reqRef.current++
    setStock(null)
    setDetail(null)
    setError(null)
    setLoading(false)
  }, [])

  return { stock, detail, loading, error, open, close }
}
