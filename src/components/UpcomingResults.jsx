// Upcoming Results page: NSE companies with an upcoming board meeting to
// consider financial results. Supports search, a date-range filter, column
// sorting, and an AI "what to expect" preview per company.

import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useResults } from '../hooks/useResults.js'
import { useResultsAnalysis } from '../hooks/useResultsAnalysis.js'
import { useResultsDetail } from '../hooks/useResultsDetail.js'
import TableSkeleton from './TableSkeleton.jsx'
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

// Format NSE's "01-OCT-2024" day label as "01 Oct 2024".
const fmtNseDay = (raw) => {
  if (!raw) return '—'
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(raw).trim())
  if (!m) return raw
  const month = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()
  return `${m[1]} ${month} ${m[3]}`
}

// Map a quarter-end day label (e.g. "30-SEP-2026") to a short month-range label
// like "Jul–Sep 2026" using the preceding three months.
const MONTH_IDX = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtQuarter = (periodTo) => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(periodTo || '').trim())
  if (!m) return periodTo || '—'
  const endMonth = MONTH_IDX[m[2].toLowerCase()]
  const endYear = Number(m[3])
  if (endMonth === undefined) return periodTo
  const startMonth = (endMonth + 10) % 12
  // The start month belongs to the previous calendar year when the quarter
  // wraps across January (e.g. Jan–Mar spans only one year, Nov is prior year).
  const startYear = startMonth > endMonth ? endYear - 1 : endYear
  const yearLabel = startYear === endYear ? `${endYear}` : `${startYear}–${endYear}`
  return `${MONTH_SHORT[startMonth]}–${MONTH_SHORT[endMonth]} ${yearLabel}`
}

// Format a ₹ crore figure in the Indian numbering system.
const fmtCr = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`
}

// Format a plain number (e.g. EPS) or show a dash.
const fmtNum = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

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

  const {
    stock: detailStock,
    detail,
    loading: detailLoading,
    error: detailError,
    open: openDetail,
    close: closeDetail
  } = useResultsDetail()

  // Show quarters oldest-first (the service returns them newest-first).
  const orderedQuarters = useMemo(
    () => (detail?.quarters ? [...detail.quarters].reverse() : []),
    [detail]
  )

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
        <TableSkeleton
          columns={['#', 'Symbol', 'Company', 'Result Date', 'Purpose', 'AI']}
          leftAlign={['Symbol', 'Company', 'Purpose']}
          rows={PAGE_SIZE}
        />
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
                    <td className="ta-left sym">
                      <button
                        className="link-btn"
                        onClick={() => openDetail(r)}
                        title="View stock details & last two quarterly results"
                      >
                        {r.symbol}
                      </button>
                    </td>
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

      {detailStock && (
        <Modal
          title={`${detailStock.symbol} · Stock Details`}
          onClose={closeDetail}
        >
          <div className="results-detail">
            <dl className="detail-grid">
              <div><dt>Symbol</dt><dd className="sym">{detailStock.symbol}</dd></div>
              <div><dt>Company</dt><dd>{detailStock.company || '—'}</dd></div>
              {detailStock.isin && <div><dt>ISIN</dt><dd>{detailStock.isin}</dd></div>}
              {detail?.faceValue != null && (
                <div><dt>Face Value</dt><dd>{fmtNum(detail.faceValue)}</dd></div>
              )}
              <div><dt>Next Result</dt><dd>{fmtDate(detailStock.date)}</dd></div>
              <div><dt>Purpose</dt><dd>{detailStock.purpose || '—'}</dd></div>
            </dl>

            <h3 className="detail-heading">Last Two Quarterly Results</h3>

            {detailLoading && (
              <TableSkeleton
                columns={['Metric', 'Quarter', 'Quarter']}
                leftAlign={['Metric']}
                rows={6}
              />
            )}
            {detailError && <p className="error">{detailError}</p>}
            {!detailLoading && !detailError && !detail?.quarters?.length && (
              <p className="info">No recent quarterly results found for this stock.</p>
            )}
            {!detailLoading && !detailError && !!detail?.quarters?.length && (
              <div className="trending-table-wrap">
                <table className="trending-table">
                  <thead>
                    <tr>
                      <th className="ta-left">Metric</th>
                      {orderedQuarters.map((q, i) => (
                        <th key={i}>
                          <div className="q-period">
                            {fmtQuarter(q.periodTo)}
                          </div>
                          {q.reportedOn && (
                            <div className="q-reported">Filed {fmtNseDay(q.reportedOn)}</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="ta-left">Revenue</td>
                      {orderedQuarters.map((q, i) => <td key={i}>{fmtCr(q.revenue)}</td>)}
                    </tr>
                    <tr>
                      <td className="ta-left">Total Income</td>
                      {orderedQuarters.map((q, i) => <td key={i}>{fmtCr(q.totalIncome)}</td>)}
                    </tr>
                    <tr>
                      <td className="ta-left">Profit Before Tax</td>
                      {orderedQuarters.map((q, i) => <td key={i}>{fmtCr(q.profitBeforeTax)}</td>)}
                    </tr>
                    <tr>
                      <td className="ta-left">Net Profit</td>
                      {orderedQuarters.map((q, i) => <td key={i}>{fmtCr(q.netProfit)}</td>)}
                    </tr>
                    <tr>
                      <td className="ta-left">EPS (₹)</td>
                      {orderedQuarters.map((q, i) => <td key={i}>{fmtNum(q.eps)}</td>)}
                    </tr>
                    <tr>
                      <td className="ta-left">Audit Status</td>
                      {orderedQuarters.map((q, i) => <td key={i}>{q.audited}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {(preview || analyzeError) && (
        <Modal
          title={`Results Preview · ${previewStock?.symbol || ''}`}
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
