// Data hook: loads IPOs from the proxy and exposes derived/filtered state.

import { useEffect, useMemo, useState } from 'react'
import { fetchIpos } from '../services/ipoApi.js'
import { FILTERS } from '../constants/ui.js'

function isOpen(ipo) {
  return ipo.status === 'Open' || ipo.status === 'Closing Today'
}

function matchesFilter(ipo, filter) {
  return (
    filter === 'All' ||
    (filter === 'Open' && isOpen(ipo)) ||
    (filter === 'Mainboard' && /IPO|Mainboard/i.test(ipo.type) && isOpen(ipo)) ||
    (filter === 'SME' && /SME/i.test(ipo.type) && isOpen(ipo)) ||
    ipo.status === filter
  )
}

export function useIpos() {
  const [ipos, setIpos] = useState([])
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('Closing Today')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchIpos()
      setIpos(data.ipos || [])
      setSource(data.source || '')
      if (data.source === 'error') setError(data.error || 'Failed to load IPOs.')
    } catch (e) {
      setError('Could not reach the StockSense proxy server. Run "npm run server".')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return ipos.filter((ipo) => {
      const matchesSearch = ipo.company.toLowerCase().includes(search.toLowerCase())
      return matchesSearch && matchesFilter(ipo, filter)
    })
  }, [ipos, filter, search])

  const counts = useMemo(() => {
    const searchMatched = ipos.filter((ipo) =>
      ipo.company.toLowerCase().includes(search.toLowerCase())
    )
    return Object.fromEntries(
      FILTERS.map((f) => [f, searchMatched.filter((ipo) => matchesFilter(ipo, f)).length])
    )
  }, [ipos, search])

  return {
    ipos,
    source,
    loading,
    error,
    filter,
    setFilter,
    search,
    setSearch,
    filtered,
    counts
  }
}
