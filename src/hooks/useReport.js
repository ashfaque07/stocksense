// Hook: loads the stored end-of-day top-gainers report records, or (when
// `today` is set) the latest stored trending gainers.

import { useCallback, useEffect, useState } from 'react'
import { fetchReport } from '../services/reportApi.js'

export function useReport(today = false) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReport(today)
      if (data.error) throw new Error(data.error)
      setRecords(data.records || [])
    } catch (err) {
      setError(err.message)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  return { records, loading, error, reload: load }
}
