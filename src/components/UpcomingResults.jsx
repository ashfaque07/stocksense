// Upcoming Results page: NSE companies with an upcoming board meeting to
// consider financial results. Supports search, a date-range filter, column
// sorting, and an AI "what to expect" preview per company.

import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useResults } from '../hooks/useResults.js'
import { useResultsAnalysis } from '../hooks/useResultsAnalysis.js'
import TrendingSkeleton from './TrendingSkeleton.jsx'
import Modal from './Modal.jsx'
import { ICONS } from '../constants/ui.js'
import { MD_COMPONENTS } from '../constants/markdown.jsx'

// Show an ISO date as a readable IST calendar date (e.g. "10 Jan 2026").
const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  })
}

// IST calendar day key (YYYY-MM-DD) for the given ISO date.
const dayKey = (iso) => (iso ? iso.slice(0, 10) : '')

const PAGE_SIZE = 20

export default function UpcomingResults() {
  const { results, timestamp, loading, error } = useResults()

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState({ key: 'date', dir: 'asc' })
  const [page, setPage] = useState(1)

  const {
    result: preview,
    stock: previewStock,
    streaming: analyzing,
    error: analyzeError,
    analyze,
    reset
  } = useResultsAnalysis()

  // Close the preview modal on Escape.
  useEffect(() => {
    if (!preview && !analyzeError) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') reset()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview, analyzeError, reset])

  const onSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  const sortIcon = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = results.filter((r) => {
      if (q) {
        const hay = `${r.symbol} ${r.company}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      const key = dayKey(r.date)
      if (from && key < from) return false
      if (to && key > to) return false
      return true
    })

    if (sort.key) {
      const mul = sort.dir === 'asc' ? 1 : -1
      const value = (r) => {
        switch (sort.key) {
          case 'symbol': return (r.symbol ?? '').toLowerCase()
          case 'company': return (r.company ?? '').toLowerCase()
          case 'purpose': return (r.purpose ?? '').toLowerCase()
          case 'date': return r.date ?? ''
          default: return ''
        }
      }
      rows = [...rows].sort((a, b) => String(value(a)).localeCompare(String(value(b))) * mul)
    }
    return rows
  }, [results, search, from, to, sort])

  // Reset to the first page whenever the filtered/sorted set changes.
  useEffect(() => {
    setPage(1)
  }, [search, from, to, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  const clearFilters = () => {
    setSearch('')
    setFrom('')
    setTo('')
  }

  const hasFilters = search || from || to

  return (
    <section className="trending">
      <div className="trending-head">
        <div className="results-filters">
          <input
            type="search"
            className="stock-input"
            placeholder={`${ICONS.search} Search symbol or company…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search upcoming results"
          />
          <label className="results-date">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          </label>
          <label className="results-date">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </label>
          {hasFilters && (
            <button className="trend-refresh" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
        <div className="trend-actions results-meta">
          <div className="trending-times">
            {!loading && <span className="trending-time">{filtered.length} companies</span>}
            {timestamp && <span className="trending-time">Updated {fmtDate(timestamp)}</span>}
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !loading && !results.length && (
        <p className="info">No upcoming results available right now.</p>
      )}
      {!error && !loading && results.length > 0 && !filtered.length && (
        <p className="info">No upcoming results match your filter.</p>
      )}

      {loading && !results.length ? (
        <TrendingSkeleton />
      ) : (
        !!filtered.length && (
          <div className="trending-table-wrap">
            <table className="trending-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="ta-left sortable" onClick={() => onSort('symbol')}>Symbol{sortIcon('symbol')}</th>
                  <th className="ta-left sortable" onClick={() => onSort('company')}>Company{sortIcon('company')}</th>
                  <th className="sortable" onClick={() => onSort('date')}>Result Date{sortIcon('date')}</th>
                  <th className="ta-left sortable" onClick={() => onSort('purpose')}>Purpose{sortIcon('purpose')}</th>
                  <th>AI</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={`${r.symbol}-${(currentPage - 1) * PAGE_SIZE + i}`}>
                    <td className="muted">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="ta-left sym">{r.symbol}</td>
                    <td className="ta-left" title={r.company}>{r.company || '—'}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td className="ta-left reason" title={r.description || r.purpose}>
                      <span className="reason-text">{r.purpose || '—'}</span>
                    </td>
                    <td>
                      <button
                        className="trend-ai-btn"
                        onClick={() => analyze(r)}
                        disabled={analyzing}
                        title="AI: what to expect from this result"
                      >
                        {ICONS.ai}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="results-pagination">
          <button
            className="trend-refresh"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            ‹ Prev
          </button>
          <span className="trending-time">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="trend-refresh"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next ›
          </button>
        </div>
      )}

      {(preview || analyzeError) && (
        <Modal
          title={`${ICONS.ai} Results Preview · ${previewStock?.symbol || ''}`}
          onClose={reset}
        >
          {analyzeError ? (
            <p className="error">{analyzeError}</p>
          ) : (
            <div className="summary markdown">
              {analyzing && !preview?.summary && (
                <p className="info">{ICONS.ai} Analyzing in real time…</p>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {preview?.summary || ''}
              </ReactMarkdown>
              {analyzing && <span className="cursor">{ICONS.cursor}</span>}
            </div>
          )}
        </Modal>
      )}
    </section>
  )
}
