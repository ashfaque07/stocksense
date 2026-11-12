// End-of-day report: the top 3 gainers captured at the 15:30 IST close, one
// batch per trading day, shown as a table with CSV download.

import { useState } from 'react'
import { useReport } from '../hooks/useReport.js'
import TrendingHistoryModal from './TrendingHistoryModal.jsx'
import TrendingSkeleton from './TrendingSkeleton.jsx'
import { ICONS } from '../constants/ui.js'
import { toCsv, downloadCsv } from '../utils/csv.js'
import { fmtNum, fmtCount, fmtCompact, fmtTime, fmtDate } from '../utils/format.js'

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v)

// Shared by the table and the CSV. `cell` renders the table value; `csv`
// (optional) overrides the raw value written to the CSV.
const COLUMNS = [
  { key: 'date', label: 'Date', cell: (r) => fmtDate(r.date), csv: (r) => fmtDate(r.date) },
  { key: 'symbol', label: 'Symbol', left: true, cell: (r) => r.symbol },
  { key: 'ltp', label: 'LTP', cell: (r) => fmtNum(r.ltp) },
  {
    key: 'percentChange',
    label: 'Change (%)',
    cell: (r) => (
      <span className={(r.percentChange ?? 0) >= 0 ? 'pos' : 'neg'}>
        {(r.percentChange ?? 0) >= 0 ? ICONS.up : ICONS.down} {fmtNum(r.percentChange)}%
      </span>
    )
  },
  { key: 'change', label: 'Change (₹)', cell: (r) => fmtNum(r.change) },
  { key: 'open', label: 'Open', cell: (r) => fmtNum(r.open) },
  { key: 'high', label: 'High', cell: (r) => fmtNum(r.high) },
  { key: 'low', label: 'Low', cell: (r) => fmtNum(r.low) },
  { key: 'prevClose', label: 'Prev Close', cell: (r) => fmtNum(r.prevClose) },
  { key: 'vwap', label: 'VWAP', cell: (r) => fmtNum(r.vwap) },
  { key: 'volume', label: 'Volume', cell: (r) => fmtCount(r.volume) },
  { key: 'turnover', label: 'Turnover (₹ L)', cell: (r) => fmtCompact(r.turnover) },
  { key: 'marketCap', label: 'Mkt Cap', cell: (r) => fmtCount(r.marketCap) },
  { key: 'lowerCircuit', label: 'Lower Circuit', cell: (r) => fmtNum(r.lowerCircuit) },
  { key: 'upperCircuit', label: 'Upper Circuit', cell: (r) => fmtNum(r.upperCircuit) },
  { key: 'priceBand', label: 'Price Band', cell: (r) => dash(r.priceBand) },
  { key: 'aiRecommended', label: 'AI Pick', cell: (r) => (r.aiRecommended ? ICONS.ai : '—'), csv: (r) => (r.aiRecommended ? 'Yes' : 'No') },
  { key: 'createdAt', label: 'Created', cell: (r) => fmtTime(r.createdAt) },
  { key: 'modifiedAt', label: 'Modified', cell: (r) => fmtTime(r.modifiedAt) }
]

export default function Report() {
  const { records, loading, error, reload } = useReport()
  const [selected, setSelected] = useState(null)

  const onDownload = () => {
    const stamp = fmtDate(new Date().toISOString())
    downloadCsv(toCsv(records, COLUMNS), `top-gainers-report-${stamp}.csv`)
  }

  return (
    <section className="trending">
      <div className="trending-head">
        <div className="trending-meta">
          {!loading && <span className="trending-time">{records.length} record(s)</span>}
        </div>
        <div className="trend-actions">
          <button className="trend-refresh" onClick={reload} disabled={loading}>
            {loading ? 'Loading…' : '↻ Reload'}
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
        <TrendingSkeleton />
      ) : (
        !!records.length && (
          <div className="trending-table-wrap">
            <table className="trending-table">
              <thead>
                <tr>
                  <th>#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={c.left ? 'ta-left' : ''}>{c.label}</th>
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
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={c.left ? 'ta-left' : ''}>{c.cell(r)}</td>
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
