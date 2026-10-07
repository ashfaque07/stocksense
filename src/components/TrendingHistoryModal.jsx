// Modal that shows the % change history for a single trending stock, with one
// row per refresh (time + % change + LTP).

import { ICONS } from '../constants/ui.js'
import Modal from './Modal.jsx'

const fmtNum = (n, d = 2) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  })
}

const fmtInt = (n) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-IN')

// NSE returns a literal "-" when a field has no value; treat it as empty.
const clean = (v) => {
  const s = (v ?? '').toString().trim()
  return s === '-' ? '' : s
}

export default function TrendingHistoryModal({ stock, onClose }) {
  if (!stock) return null

  // Oldest first (chronological), numbered 1..n.
  const history = stock.history || []
  const up = (stock.percentChange ?? 0) >= 0
  const reason = clean(stock.reason)
  const exDate = clean(stock.reasonExDate)

  return (
    <Modal title={`${stock.symbol} · Details`} onClose={onClose}>
      <dl className="trending-details">
        <div>
          <dt>LTP</dt>
          <dd>
            {fmtNum(stock.ltp)}{' '}
            <span className={up ? 'pos' : 'neg'}>
              ({up ? ICONS.up : ICONS.down} {fmtNum(stock.percentChange)}%)
            </span>
          </dd>
        </div>
        <div>
          <dt>Day Range</dt>
          <dd>
            <span className="pos" title="Day High">H {fmtNum(stock.high)}</span>{' '}
            <span className="neg" title="Day Low">L {fmtNum(stock.low)}</span>
          </dd>
        </div>
        <div>
          <dt>Open</dt>
          <dd>{fmtNum(stock.open)}</dd>
        </div>
        <div>
          <dt>Prev Close</dt>
          <dd>{fmtNum(stock.prevClose)}</dd>
        </div>
        <div>
          <dt>Volume</dt>
          <dd>{fmtInt(stock.volume)}</dd>
        </div>
        <div>
          <dt>Turnover (₹ L)</dt>
          <dd>{fmtNum(stock.turnover)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{fmtTime(stock.createdAt)}</dd>
        </div>
        <div>
          <dt>Modified</dt>
          <dd>{fmtTime(stock.modifiedAt)}</dd>
        </div>
        <div>
          <dt>Reason (Trending)</dt>
          <dd
            className="trending-reason"
            title={reason ? (exDate ? `${reason} · Ex-date: ${exDate}` : reason) : ''}
          >
            {reason ? (exDate ? `${reason} · Ex-date: ${exDate}` : reason) : '—'}
          </dd>
        </div>
      </dl>

      <h4 className="trending-details-head">% Change History</h4>
      {!history.length ? (
        <p className="info">No history recorded yet for this stock.</p>
      ) : (
        <div className="trending-table-wrap" style={{ marginTop: 14 }}>
            <table className="trending-table" style={{ minWidth: 'auto' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Change (%)</th>
                  <th>LTP</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const up = (h.percentChange ?? 0) >= 0
                  return (
                    <tr key={h.time || i}>
                      <td className="muted">{i + 1}</td>
                      <td>{fmtTime(h.time)}</td>
                      <td>
                        <span className={up ? 'pos' : 'neg'}>
                          {up ? ICONS.up : ICONS.down} {fmtNum(h.percentChange)}%
                        </span>
                      </td>
                      <td>{fmtNum(h.ltp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      )}
    </Modal>
  )
}
