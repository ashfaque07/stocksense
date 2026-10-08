// Live trending stocks page: NSE top gainers / losers (All Securities).

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTrending } from '../hooks/useTrending.js'
import { useTrendingAnalysis } from '../hooks/useTrendingAnalysis.js'
import TrendingHistoryModal from './TrendingHistoryModal.jsx'
import Modal from './Modal.jsx'
import { ICONS } from '../constants/ui.js'
import { fmtNum, fmtCount, fmtCompact, fmtTime } from '../utils/format.js'

// NSE returns a literal "-" when a field has no value; treat it as empty.
const clean = (v) => {
  const s = (v ?? '').toString().trim()
  return s === '-' ? '' : s
}

export default function TrendingStocks() {
  const {
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
    reload
  } = useTrending()

  const [selected, setSelected] = useState(null)
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const {
    result: bestPick,
    streaming: analyzing,
    error: analyzeError,
    analyze: analyzeBest,
    reset: resetBest
  } = useTrendingAnalysis()

  // Close the best-pick modal when Escape is pressed.
  useEffect(() => {
    if (!bestPick && !analyzeError) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') resetBest()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bestPick, analyzeError, resetBest])

  // Toggle sort: first click ascending, second descending, third clears.
  const onSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  // Value accessors per sortable column.
  const sortValue = (s, key) => {
    switch (key) {
      case 'symbol': return (s.symbol ?? '').toString().toLowerCase()
      case 'ltp': return s.percentChange
      case 'open': return s.open
      case 'prev': return s.prevClose
      case 'volume': return s.volume
      case 'turnover': return s.turnover
      case 'reason': return clean(s.reason).toLowerCase()
      case 'created': return s.createdAt ? new Date(s.createdAt).getTime() : null
      case 'modified': return s.modifiedAt ? new Date(s.modifiedAt).getTime() : null
      default: return null
    }
  }

  const sortedStocks = (() => {
    if (!sort.key) return stocks
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...stocks].sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      const aEmpty = av === null || av === undefined || av === '' || Number.isNaN(av)
      const bEmpty = bv === null || bv === undefined || bv === '' || Number.isNaN(bv)
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * mul
      }
      return (av - bv) * mul
    })
  })()

  const sortIcon = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <section className="trending">
      <div className="trending-head">
        <div className="trending-tabs">
          <button
            className={`trend-tab ${type === 'gainers' ? 'active' : ''}`}
            onClick={() => setType('gainers')}
          >
            🚀 Top Gainers
          </button>
          <button
            className={`trend-tab ${type === 'losers' ? 'active' : ''}`}
            onClick={() => setType('losers')}
          >
            📉 Top Losers
          </button>
        </div>
        <div className="trending-meta">
          {marketOpen ? (
            <span className="badge" title="NSE market is open">Live</span>
          ) : (
            <span className="market-status closed" title="NSE market is closed">
              <span className="market-dot" />
              Market Closed
            </span>
          )}
          {dayStartedAt && <span className="trending-time">Day start {fmtTime(dayStartedAt)}</span>}
          {updatedAt && <span className="trending-time">Updated {fmtTime(updatedAt)}</span>}
          {timestamp && <span className="trending-time">NSE {timestamp}</span>}
          <div className="trend-actions">
            <button
              className="trend-ai-btn"
              onClick={() => analyzeBest(type, stocks)}
              disabled={analyzing || loading || !stocks.length}
            >
              {analyzing ? 'Analyzing…' : `${ICONS.ai} AI Best Pick`}
            </button>
            <button className="trend-refresh" onClick={reload} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !loading && !stocks.length && (
        <p className="info">No trending stocks available right now.</p>
      )}

      {loading && !stocks.length ? (
        <p className="info">Loading live trending stocks…</p>
      ) : (
        !!stocks.length && (
          <div className="trending-table-wrap">
            <table className="trending-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="ta-left sortable" onClick={() => onSort('symbol')}>Symbol{sortIcon('symbol')}</th>
                  <th className="sortable" title="Last Traded Price (% change from prev close)" onClick={() => onSort('ltp')}>LTP (%){sortIcon('ltp')}</th>
                  <th className="sortable" onClick={() => onSort('open')}>Open{sortIcon('open')}</th>
                  <th className="sortable" title="Previous Close" onClick={() => onSort('prev')}>Prev{sortIcon('prev')}</th>
                  <th title="Intraday High and Low">Day Range</th>
                  <th className="sortable" title="Shares traded" onClick={() => onSort('volume')}>Vol{sortIcon('volume')}</th>
                  <th className="sortable" title="Traded value (₹)" onClick={() => onSort('turnover')}>Turnover{sortIcon('turnover')}</th>
                  <th className="ta-left sortable" onClick={() => onSort('reason')}>Reason (Trending){sortIcon('reason')}</th>
                  <th className="sortable" onClick={() => onSort('created')}>Created{sortIcon('created')}</th>
                  <th className="sortable" onClick={() => onSort('modified')}>Modified{sortIcon('modified')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedStocks.map((s, i) => {
                  const up = (s.percentChange ?? 0) >= 0
                  const reason = clean(s.reason)
                  const exDate = clean(s.reasonExDate)
                  return (
                    <tr
                      key={s.symbol}
                      className={`clickable ${s.stale ? 'stale' : ''}`}
                      onClick={() => setSelected(s)}
                      title="View % change history"
                    >
                      <td className="muted">{i + 1}</td>
                      <td className="ta-left sym">
                        {s.symbol}
                        {s.aiRecommended && (
                          <span
                            className="ai-badge"
                            title={`AI recommended pick${s.aiRecommendedAt ? ` at ${fmtTime(s.aiRecommendedAt)}` : ''}`}
                          >
                            {ICONS.ai}
                          </span>
                        )}
                        {s.stale && (
                          <span className="stale-badge" title="Not in the latest refresh">
                            ∅
                          </span>
                        )}
                      </td>
                      <td>
                        {fmtNum(s.ltp)}{' '}
                        <span className={up ? 'pos' : 'neg'}>
                          ({up ? '▲' : '▼'} {fmtNum(s.percentChange)}%)
                        </span>
                      </td>
                      <td>{fmtNum(s.open)}</td>
                      <td>{fmtNum(s.prevClose)}</td>
                      <td className="day-range">
                        <span className="pos" title="Day High">H {fmtNum(s.high)}</span>
                        <span className="neg" title="Day Low">L {fmtNum(s.low)}</span>
                      </td>
                      <td>{fmtCount(s.volume)}</td>
                      <td>{fmtCompact(s.turnover)}</td>
                      <td className="ta-left reason" title={reason ? (exDate ? `${reason} · Ex-date: ${exDate}` : reason) : 'No reason found'}>
                        <span className="reason-text">{reason || '—'}</span>
                      </td>
                      <td className="muted">{fmtTime(s.createdAt)}</td>
                      <td className="muted">{fmtTime(s.modifiedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <TrendingHistoryModal stock={selected} onClose={() => setSelected(null)} />

      {(bestPick || analyzeError) && (
        <Modal
          title={`AI Best Trending Pick · ${type === 'losers' ? 'Losers' : 'Gainers'}`}
          onClose={resetBest}
        >
          {analyzeError && <p className="error">{analyzeError}</p>}
          {analyzing && !bestPick?.summary && (
            <p className="info">{ICONS.ai} Ranking trending stocks in real time…</p>
          )}
          {bestPick && (
            <div className="summary markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{bestPick.summary}</ReactMarkdown>
              {analyzing && <span className="cursor">▍</span>}
              {!analyzing && (
                <p className="disclaimer"><em>Disclaimer: Automated analysis, not investment advice.</em></p>
              )}
            </div>
          )}
        </Modal>
      )}
    </section>
  )
}
