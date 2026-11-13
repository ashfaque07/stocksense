// End-of-day report: the top 3 gainers captured at the 15:30 IST close, one
// batch per trading day, shown as a table with CSV download.

import { useEffect, useState } from 'react'
import { useReport } from '../hooks/useReport.js'
import TrendingHistoryModal from './TrendingHistoryModal.jsx'
import ReportSkeleton from './ReportSkeleton.jsx'
import { ICONS } from '../constants/ui.js'
import { toCsv, downloadCsv } from '../utils/csv.js'
import { fmtNum, fmtCount, fmtCompact, fmtTime, fmtDate } from '../utils/format.js'
import { CATEGORY_TONE } from '../constants/guide.js'


// Full flat columns, used only for the CSV export. `csv` (optional) overrides the
// raw value written to the CSV.
const CSV_COLUMNS = [
  { key: 'date', label: 'Date', csv: (r) => fmtDate(r.date) },
  { key: 'symbol', label: 'Symbol' },
  { key: 'category', label: 'Category', csv: (r) => r.verdict?.category ?? '' },
  { key: 'verdict', label: 'Verdict', csv: (r) => (r.verdict?.statements ?? []).map((s) => s.text).join(' | ') },
  { key: 'ltp', label: 'LTP' },
  { key: 'percentChange', label: 'Change (%)' },
  { key: 'change', label: 'Change (₹)' },
  { key: 'open', label: 'Open' },
  { key: 'high', label: 'High' },
  { key: 'low', label: 'Low' },
  { key: 'prevClose', label: 'Prev Close' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'volume', label: 'Volume' },
  { key: 'turnover', label: 'Turnover (₹ L)' },
  { key: 'marketCap', label: 'Mkt Cap' },
  { key: 'lowerCircuit', label: 'Lower Circuit' },
  { key: 'upperCircuit', label: 'Upper Circuit' },
  { key: 'priceBand', label: 'Price Band' },
  { key: 'aiRecommended', label: 'AI Pick', csv: (r) => (r.aiRecommended ? 'Yes' : 'No') },
  { key: 'createdAt', label: 'Created' },
  { key: 'modifiedAt', label: 'Modified' }
]

// A small "label value" line used inside the grouped cells.
const kv = (k, v) => (
  <div className="kv">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
)

// Compact on-screen columns: related fields are grouped into one cell so each
// row stays short.
const TABLE_COLUMNS = [
  {
    key: 'stock',
    label: 'Stock',
    left: true,
    cell: (r) => (
      <div className="stock-cell">
        <div>
          <span className="sym">{r.symbol}</span>
          {r.aiRecommended && <span className="ai-flag" title="Recommended by AI"> {ICONS.ai}</span>}
        </div>
        {r.verdict?.category && (
          <span className="verdict-category" data-tone={CATEGORY_TONE[r.verdict.category] || 'neutral'}>
            {r.verdict.category}
          </span>
        )}
      </div>
    )
  },
  {
    key: 'price',
    label: 'Price',
    cell: (r) => (
      <div>
        <div className="price">{fmtNum(r.ltp)}</div>
        <div className={(r.percentChange ?? 0) >= 0 ? 'pos' : 'neg'}>
          {(r.percentChange ?? 0) >= 0 ? ICONS.up : ICONS.down} {fmtNum(r.percentChange)}%
        </div>
      </div>
    )
  },
  {
    key: 'verdict',
    label: 'Verdict',
    left: true,
    cell: (r) =>
      r.verdict?.statements?.length ? (
        <ul className="verdict-list">
          {r.verdict.statements.map((s) => (
            <li key={s.code} className={`verdict-${s.tone}`}>{s.text}</li>
          ))}
        </ul>
      ) : (
        '—'
      )
  },
  {
    key: 'range',
    label: 'Day Range',
    cell: (r) => (
      <div className="kv-grid">
        {kv('Prev Close', fmtNum(r.prevClose))}
        {kv('Open', fmtNum(r.open))}
        {kv('Low', fmtNum(r.low))}
        {kv('High', fmtNum(r.high))}
        {kv('VWAP', fmtNum(r.vwap))}
      </div>
    )
  },
  {
    key: 'activity',
    label: 'Activity & Circuit',
    cell: (r) => (
      <div className="kv-grid">
        {kv('Volume', fmtCount(r.volume))}
        {kv('Turnover', fmtCompact(r.turnover))}
        {kv('Lower', fmtNum(r.lowerCircuit))}
        {kv('Upper', fmtNum(r.upperCircuit))}
        {kv('Mkt Cap', fmtCount(r.marketCap))}
      </div>
    )
  },
  {
    key: 'datetime',
    label: 'Date & Time',
    cell: (r) => (
      <div className="kv-grid">
        {kv('Date', fmtDate(r.date))}
        {kv('Created', fmtTime(r.createdAt))}
        {kv('Modified', fmtTime(r.modifiedAt))}
      </div>
    )
  }
]

const TODAY_KEY = 'stocksense-report-today'

export default function Report() {
  const [todayOnly, setTodayOnly] = useState(() => localStorage.getItem(TODAY_KEY) === '1')
  useEffect(() => {
    localStorage.setItem(TODAY_KEY, todayOnly ? '1' : '0')
  }, [todayOnly])
  const { records, loading, error } = useReport(todayOnly)
  const [selected, setSelected] = useState(null)
  const [copied, setCopied] = useState(false)

  // Copy the full stored records (including intraday history) as pretty JSON.
  const onCopyJson = async () => {
    const text = JSON.stringify(records, null, 2)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onDownload = () => {
    const stamp = fmtDate(new Date().toISOString())
    downloadCsv(toCsv(records, CSV_COLUMNS), `top-gainers-report-${stamp}.csv`)
  }

  return (
    <section className="trending">
      <div className="trending-head">
        <div className="trending-meta">
          <label className="switch" title="Show the latest trending gainers">
            <input
              type="checkbox"
              role="switch"
              checked={todayOnly}
              onChange={(e) => setTodayOnly(e.target.checked)}
            />
            <span className="switch-track" aria-hidden="true" />
            <span className="switch-label">Today</span>
          </label>
          {!loading && <span className="trending-time">{records.length} record(s)</span>}
        </div>
        <div className="trend-actions report-actions">
          <button className="trend-refresh" onClick={onCopyJson} disabled={loading || !records.length}>
            {copied ? '✔ Copied' : '⧉ Copy JSON'}
          </button>
          <button className="trend-ai-btn" onClick={onDownload} disabled={loading || !records.length}>
            ⬇ Download CSV
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !loading && !records.length && (
        <p className="info">No report yet. The top 3 gainers are recorded at the 3:30 PM market close.</p>
      )}

      {loading && !records.length ? (
        <ReportSkeleton />
      ) : (
        !!records.length && (
          <div className="trending-table-wrap">
            <table className="trending-table report-table">
              <thead>
                <tr>
                  <th>#</th>
                  {TABLE_COLUMNS.map((c) => (
                    <th key={c.key} className={`col-${c.key}${c.left ? ' ta-left' : ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr
                    key={`${r.date}-${r.symbol}`}
                    className="clickable"
                    onClick={() => setSelected(r)}
                    title="View intraday % change history"
                  >
                    <td className="muted">{i + 1}</td>
                    {TABLE_COLUMNS.map((c) => (
                      <td key={c.key} className={`col-${c.key}${c.left ? ' ta-left' : ''}`}>{c.cell(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <TrendingHistoryModal stock={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
