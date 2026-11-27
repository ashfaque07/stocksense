// Auto trading dashboard: mode, config, trade log and manual controls.

import { useCallback, useEffect, useState } from 'react'
import { fetchTrades, runTradeCycle, saveUpstoxToken } from '../services/tradeApi.js'

const KEY_STORAGE = 'tradeAdminKey'
const fmt = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(2))
const fmtTime = (v) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '-'

export default function AutoTrading() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(KEY_STORAGE) || '')
  const [token, setToken] = useState('')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!adminKey) return
    setError('')
    try {
      setData(await fetchTrades(adminKey))
    } catch (err) {
      setError(err.message)
    }
  }, [adminKey])

  useEffect(() => {
    sessionStorage.setItem(KEY_STORAGE, adminKey)
    load()
  }, [adminKey, load])

  const act = async (fn, okText) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const out = await fn()
      setMessage(okText(out))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const run = () =>
    act(
      () => runTradeCycle(adminKey),
      (o) => (o.skipped ? `Skipped: ${o.skipped}` : `Ran (${o.mode}): ${o.results.length} action(s)`)
    )

  const saveToken = () =>
    act(
      () => saveUpstoxToken(adminKey, token),
      () => 'Access token saved.'
    ).then(() => setToken(''))

  return (
    <section className="intraday">
      <div className="intraday-opts">
        <input
          type="password"
          placeholder="Admin key"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
        />
        <button className="intraday-btn" onClick={load} disabled={busy || !adminKey}>
          Refresh
        </button>
        <button className="intraday-btn" onClick={run} disabled={busy || !adminKey}>
          Run cycle now
        </button>
      </div>

      <div className="intraday-opts">
        <input
          type="password"
          placeholder="Upstox access token (valid for the day)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button className="intraday-btn" onClick={saveToken} disabled={busy || !adminKey || !token}>
          Save token
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="info">{message}</p>}

      {data && (
        <>
          <p className="info">
            Mode: <strong>{data.mode.toUpperCase()}</strong> | Scheduler: {data.enabled ? 'on' : 'off'} | Capital/trade: ₹
            {data.config.capitalPerTrade} | SL {data.config.stopLossPercent}% | Target {data.config.targetPercent}% |
            Max trades/day {data.config.maxPositions} | Total P&amp;L:{' '}
            <strong className={data.totalPnl >= 0 ? 'pos' : 'neg'}>₹{fmt(data.totalPnl)}</strong>
          </p>

          <div className="intraday-table-wrap">
            <table className="intraday-table">
              <thead>
                <tr>
                  {['Date', 'Symbol', 'Mode', 'Status', 'Qty', 'Entry', 'SL', 'Target', 'Exit', 'Reason', 'P&L', 'In', 'Out', 'Signal'].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.trades.map((t) => (
                  <tr key={t.id} title={t.error || ''}>
                    <td>{t.trade_date}</td>
                    <td>{t.symbol}</td>
                    <td>{t.mode}</td>
                    <td>{t.status}</td>
                    <td>{t.qty}</td>
                    <td>{fmt(t.entry_price)}</td>
                    <td>{fmt(t.sl_price)}</td>
                    <td>{fmt(t.target_price)}</td>
                    <td>{fmt(t.exit_price)}</td>
                    <td>{t.exit_reason || '-'}</td>
                    <td className={Number(t.pnl) >= 0 ? 'pos' : 'neg'}>{t.pnl === null ? '-' : fmt(t.pnl)}</td>
                    <td>{fmtTime(t.entry_time)}</td>
                    <td>{fmtTime(t.exit_time)}</td>
                    <td>{t.signal?.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.trades.length && <p className="info">No trades yet.</p>}
        </>
      )}
    </section>
  )
}
