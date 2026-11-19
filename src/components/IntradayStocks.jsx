// Intraday rally screener: logic from the stock-screener reference, data from trending gainers.

import { Fragment, useMemo, useState } from 'react'
import { MAX_SCORE, STAGE_ORDER, analyzeStore, istTime, mergeData } from '../utils/intradayScreener.js'
import { useTrending } from '../hooks/useTrending.js'

// Trending turnover is in rupees lakh.
const TURNOVER_UNIT = 1e5

// IST calendar date (YYYY-MM-DD) for an ISO timestamp.
const istDate = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

const PRIORITY = { IMMINENT: 3, COILING: 2, CANDIDATE: 1 }

const COLUMNS = [
  ['symbol', 'Symbol'],
  ['date', 'Date'],
  ['score', 'Score'],
  ['best', 'Best'],
  ['stage', 'Stage'],
  ['coil', 'Coil (IST)'],
  ['lead', 'Lead (min)'],
  ['fw', 'Watch-hit'],
  ['uc', 'UC hit'],
  ['pct', '% chg'],
  ['ltp', 'LTP'],
  ['vwapGap', 'vs VWAP'],
  ['turnover', 'Turnover'],
  ['mcap', 'MCap (Cr)']
]

const sortValue = (r, key) =>
  ({
    symbol: r.s.symbol,
    date: r.s.date,
    score: r.score,
    best: r.best,
    pct: r.lastPt.percentChange,
    ltp: r.lastPt.ltp,
    vwapGap: (r.lastPt.ltp - r.lastPt.vwap) / r.lastPt.vwap,
    turnover: r.lastPt.turnover,
    mcap: r.s.marketCap,
    uc: r.uc ? +r.uc : 9e15,
    fw: r.firstWatch ? +new Date(r.firstWatch.time) : 9e15,
    stage: STAGE_ORDER.indexOf(r.stage),
    coil: r.coil ? +r.coil : 9e15,
    lead: r.lead == null ? -1 : r.lead
  })[key]

const gapPct = (p) => ((p.ltp - p.vwap) / p.vwap) * 100

export default function IntradayStocks() {
  const { stocks, loading, refreshing, error, reload, dayStartedAt } = useTrending()
  const [thr, setThr] = useState(10)
  const [onlyWatch, setOnlyWatch] = useState(false)
  const [sort, setSort] = useState({ key: 'score', dir: -1 })
  const [open, setOpen] = useState(null)

  const rows = useMemo(() => {
    const date = new Date(dayStartedAt || Date.now()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const data = stocks.filter((s) => !s.stale).map((s) => ({ ...s, date }))
    return analyzeStore(mergeData({}, data).store, thr, TURNOVER_UNIT)
  }, [stocks, dayStartedAt, thr])

  const list = useMemo(() => {
    const l = rows.filter((r) => !onlyWatch || r.score >= thr)
    return l.sort((a, b) => (sortValue(a, sort.key) > sortValue(b, sort.key) ? 1 : -1) * sort.dir)
  }, [rows, onlyWatch, thr, sort])

  const newest = list.length ? Math.max(...list.map((r) => +new Date(r.lastPt.time))) : 0
  const picks = list
    .filter((r) => PRIORITY[r.stage])
    .sort((a, b) => PRIORITY[b.stage] - PRIORITY[a.stage] || b.score - a.score)
  const hit = list.filter((r) => r.stage === 'HIT')
  const avoid = list.filter((r) => r.stage === 'AVOID')

  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))

  return (
    <section className="intraday">
      <div className="intraday-opts">
        <label>
          Watch threshold{' '}
          <input
            type="number"
            id="watch-threshold"
            min={0}
            max={MAX_SCORE}
            value={thr}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              setThr(Number.isFinite(n) ? Math.min(MAX_SCORE, Math.max(0, n)) : 0)
            }}
          />
        </label>
        <label>
          <input type="checkbox" checked={onlyWatch} onChange={(e) => setOnlyWatch(e.target.checked)} /> Watch-list only
        </label>
        <button className="intraday-btn" onClick={reload} disabled={loading || refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        {newest > 0 && <span className="intraday-info">Latest snapshot: {istTime(new Date(newest))} IST</span>}
      </div>
      {error && <p className="error">{error}</p>}

      {list.length > 0 && (
        <div className="intraday-picks">
          <h3>Pick now ({picks.length})</h3>
          {picks.length === 0 && <p className="info">No stock is in CANDIDATE / COILING / IMMINENT right now.</p>}
          {picks.map((r) => {
            const p = r.lastPt
            const g = gapPct(p)
            const stale = newest - new Date(p.time) > 20 * 60000
            return (
              <div key={r.s.date + r.s.symbol} className={`intraday-pick ${r.stage}`}>
                <b>{r.s.symbol}</b> <span className={`stg ${r.stage}`}>{r.stage}</span> score {r.score}
                {' · '}{p.percentChange.toFixed(2)}% · LTP {p.ltp} · vs VWAP{' '}
                <span className={g >= 0 ? 'pos' : 'neg'}>{g.toFixed(2)}%</span> · {istTime(new Date(p.time))} IST
                {r.n < 3 && <span className="neg"> · few snapshots ({r.n})</span>}
                {stale && <span className="neg"> · stale data</span>}
                <div className="intraday-sub">{r.tags.filter((t) => t[0] > 0).map((t) => t[1]).join(', ')}</div>
              </div>
            )
          })}
          <p className="intraday-sub">
            Already at UC: {hit.map((r) => r.s.symbol).join(', ') || '-'} | Avoid:{' '}
            {avoid.map((r) => r.s.symbol).join(', ') || '-'}
          </p>
        </div>
      )}

      {list.length > 0 ? (
        <div className="intraday-table-wrap">
          <table className="intraday-table">
            <thead>
              <tr>
                {COLUMNS.map(([k, t]) => (
                  <th key={k} onClick={() => sortBy(k)}>
                    {t}{sort.key === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const id = r.s.date + r.s.symbol
                const s = { ...r.s, ...r.lastPt }
                const g = gapPct(s)
                return (
                  <Fragment key={id}>
                    <tr className={r.score >= thr ? 'watch' : ''} onClick={() => setOpen(open === id ? null : id)}>
                      <td><b>{s.symbol}</b></td>
                      <td>{s.date}</td>
                      <td><b>{r.score}</b></td>
                      <td>{r.best}</td>
                      <td><span className={`stg ${r.stage}`}>{r.stage}</span></td>
                      <td>{istTime(r.coil)}</td>
                      <td>{r.lead == null ? '-' : r.lead}</td>
                      <td>{r.firstWatch ? istTime(new Date(r.firstWatch.time)) : '-'}</td>
                      <td>{istTime(r.uc)}</td>
                      <td className={s.percentChange >= 0 ? 'pos' : 'neg'}>{s.percentChange.toFixed(2)}%</td>
                      <td>{s.ltp}</td>
                      <td className={g >= 0 ? 'pos' : 'neg'}>{g.toFixed(2)}%</td>
                      <td>{Math.round(s.turnover).toLocaleString()}</td>
                      <td>{(s.marketCap / 1e7).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td>{s.verdict ? s.verdict.category : ''}</td>
                    </tr>
                    {open === id && (
                      <tr className="detail">
                        <td colSpan={COLUMNS.length + 1}>
                          {r.tags.length
                            ? r.tags.map((t) => (
                                <span key={t[1]} className={`tag ${t[0] > 0 ? 'p' : 'n'}`}>
                                  {t[0] > 0 ? '+' : ''}{t[0]} {t[1]}
                                </span>
                              ))
                            : 'No signals'}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="info">{loading ? 'Loading trending gainers…' : 'No trending gainers available.'}</p>
      )}

      {list.length > 0 && (
        <div className="intraday-cards">
          {list.map((r) => {
            const id = r.s.date + r.s.symbol
            const s = { ...r.s, ...r.lastPt }
            const g = gapPct(s)
            return (
              <div
                key={id}
                className={`intraday-card ${r.score >= thr ? 'watch' : ''}`}
                onClick={() => setOpen(open === id ? null : id)}
              >
                <div className="intraday-card-head">
                  <b>{s.symbol}</b>
                  <span className={`stg ${r.stage}`}>{r.stage}</span>
                  <span className="intraday-card-score">Score {r.score}</span>
                </div>
                <div className="intraday-card-grid">
                  <span>% chg <b className={s.percentChange >= 0 ? 'pos' : 'neg'}>{s.percentChange.toFixed(2)}%</b></span>
                  <span>LTP <b>{s.ltp}</b></span>
                  <span>vs VWAP <b className={g >= 0 ? 'pos' : 'neg'}>{g.toFixed(2)}%</b></span>
                  <span>Best <b>{r.best}</b></span>
                  <span>Turnover <b>{Math.round(s.turnover).toLocaleString()}</b></span>
                  <span>MCap (Cr) <b>{(s.marketCap / 1e7).toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
                  <span>Coil <b>{istTime(r.coil)}</b></span>
                  <span>UC hit <b>{istTime(r.uc)}</b></span>
                </div>
                {open === id && (
                  <div className="intraday-card-tags">
                    {r.tags.length
                      ? r.tags.map((t) => (
                          <span key={t[1]} className={`tag ${t[0] > 0 ? 'p' : 'n'}`}>
                            {t[0] > 0 ? '+' : ''}{t[0]} {t[1]}
                          </span>
                        ))
                      : 'No signals'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
