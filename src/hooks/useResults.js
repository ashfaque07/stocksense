// Hook: loads upcoming financial results (NSE board meetings) from the proxy.

import { useCallback, useEffect, useState } from 'react'
import { fetchResults } from '../services/resultsApi.js'

export function useResults() {
  const [results, setResults] = useState([])
  const [timestamp, setTimestamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else {
      setLoading(true)
      setResults([])
    }
    setError(null)
    try {
      const data = await fetchResults()
      if (data.error) throw new Error(data.error)
      setResults(data.results || [])
      setTimestamp(data.timestamp || null)
    } catch (err) {
      setError(err.message)
      if (!force) setResults([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refetch on bfcache restore so a duplicated tab doesn't show a stale list.
  useEffect(() => {
    const refetch = (e) => {
      if (e.persisted) load()
    }
    window.addEventListener('pageshow', refetch)
    return () => window.removeEventListener('pageshow', refetch)
  }, [load])

  return {
    results,
    timestamp,
    loading,
    refreshing,
    error,
    reload: () => load(true)
  }
}
