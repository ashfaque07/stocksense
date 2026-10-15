// Hook: loads live trending stocks (top gainers / losers) from the proxy.

import { useCallback, useEffect, useState } from 'react'
import { fetchTrending } from '../services/trendingApi.js'

export function useTrending() {
  const [type, setType] = useState('gainers')
  const [stocks, setStocks] = useState([])
  const [timestamp, setTimestamp] = useState(null)
  const [dayStartedAt, setDayStartedAt] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [marketOpen, setMarketOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (nextType, force = false) => {
    if (force) setRefreshing(true)
    else {
      setLoading(true)
      setStocks([])
    }
    setError(null)
    try {
      const data = await fetchTrending(nextType, force)
      if (data.error) throw new Error(data.error)
      setStocks(data.stocks || [])
      setTimestamp(data.timestamp || null)
      setDayStartedAt(data.dayStartedAt || null)
      setUpdatedAt(data.updatedAt || null)
      setMarketOpen(Boolean(data.marketOpen))
    } catch (err) {
      setError(err.message)
      if (!force) setStocks([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(type)
  }, [type, load])

  // Duplicating a tab restores the page from the browser's back-forward cache
  // WITHOUT remounting, so the mount effect above never re-runs and the view
  // keeps showing a stale snapshot. Refetch on `pageshow` (which fires on
  // bfcache restores) so the latest stocks load without a manual refresh.
  useEffect(() => {
    const refetch = (e) => {
      if (e.persisted) load(type)
    }
    window.addEventListener('pageshow', refetch)
    return () => window.removeEventListener('pageshow', refetch)
  }, [type, load])

  return {
    type,
    setType,
    stocks,
    timestamp,
    dayStartedAt,
    updatedAt,
    marketOpen,
    loading,
    refreshing,
    error,
    reload: () => load(type, true)
  }
}
