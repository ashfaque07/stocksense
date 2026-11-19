// Intraday rally screener logic (ported from stock-screener.html).

export const STAGE_ORDER = ['NONE', 'CANDIDATE', 'COILING', 'IMMINENT', 'HIT', 'AVOID']

// Highest reachable score: sum of every positive signal (momentum counts once, max 3).
export const MAX_SCORE = 15

function normalize(s) {
  if (!Array.isArray(s.history) || !s.history.length) {
    s.history = [
      {
        time: s.modifiedAt || s.capturedAt,
        percentChange: s.percentChange,
        ltp: s.ltp,
        vwap: s.vwap,
        turnover: s.turnover
      }
    ]
  }
  return s
}

// Merge records per date+symbol. Returns { store, added }.
export function mergeData(store, data) {
  const next = { ...store }
  let added = 0
  data.forEach((raw) => {
    const s = normalize({ ...raw })
    const key = `${s.date}|${s.symbol}`
    const cur = next[key]
    if (!cur) {
      next[key] = s
      added += s.history.length
      return
    }
    const map = new Map(cur.history.map((h) => [h.time, h]))
    const before = map.size
    s.history.forEach((h) => map.set(h.time, h))
    added += map.size - before
    const history = [...map.values()].sort((a, b) => new Date(a.time) - new Date(b.time))
    const newer = (s.modifiedAt || '') >= (cur.modifiedAt || '')
    next[key] = { ...(newer ? { ...cur, ...s } : { ...s, ...cur }), history }
  })
  return { store: next, added }
}

export function scoreAt(s, i, unit) {
  const h = s.history.slice(0, i + 1)
  const n = h.length
  const last = h[n - 1]
  const tags = []
  let p = 0
  const add = (pts, txt) => {
    p += pts
    tags.push([pts, txt])
  }
  const pc = last.percentChange
  if (pc >= 6 && pc < 12) add(2, 'Momentum 6-12%')
  else if (pc >= 12 && pc < 18) add(3, 'Momentum 12-18%')
  if (last.vwap && (last.ltp - last.vwap) / last.vwap > 0.01) add(2, 'LTP > VWAP 1%+')
  if (n > 3 && last.vwap && h[n - 4].vwap && last.vwap > h[n - 4].vwap) add(1, 'VWAP rising')
  if (n > 2 && last.turnover >= h[n - 3].turnover * 1.05) add(2, 'Turnover growing')
  const hi = Math.max(...h.map((x) => x.ltp))
  if ((hi - last.ltp) / hi < 0.02) add(1, 'Near day high')
  const turnRs = last.turnover * unit
  if (s.marketCap && turnRs / s.marketCap > 0.02) add(2, 'Turnover/MCap > 2%')
  if (s.marketCap >= 1.5e10 && s.marketCap <= 1.5e11) add(1, 'Cap 1.5k-15k Cr')
  if (n >= 3 && h[n - 1].percentChange >= h[n - 2].percentChange && h[n - 2].percentChange >= h[n - 3].percentChange) {
    add(1, 'Staircase')
  }
  const toUC = (s.upperCircuit - last.ltp) / s.upperCircuit
  if (toUC > 0.02 && toUC < 0.12) add(1, 'Near UC (2-12%)')
  if (h[0] && h[0].percentChange > 6) add(1, 'Early strength')
  if (n >= 4) {
    const w = h.slice(-4).map((x) => x.percentChange)
    if (Math.max(...w) - Math.min(...w) < 0.5 && pc < 17) add(-2, 'Stalled')
  }
  if (last.vwap && last.ltp < last.vwap) add(-3, 'LTP < VWAP')
  const peak = Math.max(...h.map((x) => x.percentChange))
  if (peak - pc >= 1) add(-2, 'Dropped from peak')
  if (last.turnover * unit < 100 * 1e7 && s.marketCap < 2e9) add(-1, 'Thin liquidity')
  return { p, tags }
}

export function ucTime(s) {
  const h = s.history.find((x) => x.ltp >= s.upperCircuit - 1e-9)
  return h ? new Date(h.time) : null
}

export function stageAt(s, i) {
  const h = s.history.slice(0, i + 1)
  const n = h.length
  const last = h[n - 1]
  const pc = last.percentChange
  if (last.ltp >= s.upperCircuit - 1e-9) return 'HIT'
  const belowVwap = last.vwap && last.ltp < last.vwap
  let lowerHighs = false
  if (n >= 4) {
    const p = h.slice(-4).map((x) => x.percentChange)
    lowerHighs = p[1] < p[0] && p[2] < p[1] && p[3] < p[2]
  }
  let stalled = false
  if (n >= 4 && pc < 17) {
    const w = h.slice(-4).map((x) => x.turnover)
    stalled = w[3] <= w[0] * 1.01 && pc >= 6
  }
  if (belowVwap || lowerHighs || stalled) return 'AVOID'
  const prev = h[n - 2]
  const tGrow = prev && prev.turnover > 0 ? last.turnover / prev.turnover - 1 : 0
  const jump = prev ? pc - prev.percentChange : 0
  if (pc >= 15 && (tGrow >= 0.15 || jump >= 3)) return 'IMMINENT'
  if (n >= 3) {
    const l3 = h.slice(-3)
    const inBand = l3.every((x) => x.percentChange >= 12 && x.percentChange <= 17)
    const rising = l3[2].turnover > l3[0].turnover
    const aboveV = last.vwap && (last.ltp - last.vwap) / last.vwap >= 0.015
    const noLower = l3[2].percentChange >= Math.max(l3[0].percentChange, l3[1].percentChange) - 0.5
    if (inBand && rising && aboveV && noLower) return 'COILING'
  }
  if (pc >= 6 && last.vwap && last.ltp > last.vwap && prev && last.turnover > prev.turnover) return 'CANDIDATE'
  return 'NONE'
}

function firstStageTime(s, names) {
  for (let i = 0; i < s.history.length; i++) {
    if (names.includes(stageAt(s, i))) return new Date(s.history[i].time)
  }
  return null
}

export function analyzeStore(store, thr, unit) {
  return Object.values(store)
    .filter((s) => Array.isArray(s.history) && s.history.length)
    .map((s) => {
      const lastIdx = s.history.length - 1
      const res = scoreAt(s, lastIdx, unit)
      let firstWatch = null
      let best = -99
      s.history.forEach((h, i) => {
        const r = scoreAt(s, i, unit)
        if (r.p > best) best = r.p
        if (!firstWatch && r.p >= thr) firstWatch = h
      })
      const uc = ucTime(s)
      const stage = stageAt(s, lastIdx)
      const coil = firstStageTime(s, ['COILING', 'IMMINENT'])
      const lead = coil && uc && coil < uc ? Math.round((uc - coil) / 60000) : null
      return { s, lastPt: s.history[lastIdx], n: s.history.length, score: res.p, tags: res.tags, best, firstWatch, uc, stage, coil, lead }
    })
}

export const istTime = (d) =>
  d
    ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' })
    : '-'
