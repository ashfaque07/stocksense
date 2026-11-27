// Intraday rally screener logic (ported from stock-screener.html).

export const STAGE_ORDER = ['NONE', 'CANDIDATE', 'COILING', 'IMMINENT', 'HIT', 'AVOID']

// Highest reachable score: sum of every positive signal's maximum.
export const MAX_SCORE = 100

const CRORE = 1e7
const MIN = 60000

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
  const lastT = new Date(last.time).getTime()
  const atOrBefore = (mins) => {
    for (let k = n - 2; k >= 0; k--) {
      if (lastT - new Date(h[k].time).getTime() >= mins * MIN) return h[k]
    }
    return null
  }
  const turnRs = last.turnover * unit
  const atUC = s.upperCircuit && last.ltp >= s.upperCircuit - 1e-9
  const toUC = s.upperCircuit ? ((s.upperCircuit - last.ltp) / s.upperCircuit) * 100 : null

  // Early gain with headroom
  if (pc >= 6 && pc < 12) add(12, 'Early gain 6-12%')
  else if (pc >= 12 && pc < 16) add(6, 'Gain 12-16%')

  // VWAP premium
  if (last.vwap) {
    const prem = ((last.ltp - last.vwap) / last.vwap) * 100
    if (prem >= 1) add(12, 'VWAP premium 1%+')
    else if (prem >= 0.3) add(8, 'VWAP premium 0.3%+')
    else if (prem > 0) add(4, 'Above VWAP')
  }

  // VWAP consistency (last 5 snapshots)
  const w5 = h.slice(-5)
  const above = w5.filter((x) => x.vwap && x.ltp > x.vwap).length
  if (w5.length === 5 && above === 5) add(12, 'Above VWAP 5/5')
  else if (w5.length >= 5 && above === 4) add(9, 'Above VWAP 4/5')
  else if (w5.length >= 3 && above === 3) add(6, 'Above VWAP 3/5')

  // 30-min change and acceleration
  const ref30 = atOrBefore(30)
  const chg30 = ref30 ? pc - ref30.percentChange : null
  if (chg30 !== null) {
    if (chg30 >= 3) add(14, '30m accel 3pp+')
    else if (chg30 >= 1.5) add(10, '30m accel 1.5pp+')
    else if (chg30 >= 0.5) add(5, '30m accel 0.5pp+')
  }

  // Turnover-rate acceleration: turnover added in last 30m vs the 30m before it
  if (ref30) {
    const ref60 = atOrBefore(60) || h[0]
    const span = new Date(ref30.time).getTime() - new Date(ref60.time).getTime()
    const recent = (last.turnover - ref30.turnover) / (lastT - new Date(ref30.time).getTime())
    const prior = span > 0 ? (ref30.turnover - ref60.turnover) / span : 0
    if (prior > 0) {
      const acc = (recent / prior - 1) * 100
      if (acc >= 50) add(12, 'Turnover rate +50%')
      else if (acc >= 20) add(8, 'Turnover rate +20%')
      else if (acc >= 0) add(4, 'Turnover rate up')
    }
  }

  // Liquidity / churn (needs >= 1 Cr turnover)
  if (s.marketCap && turnRs >= CRORE) {
    const churn = (turnRs / s.marketCap) * 100
    if (churn >= 3) add(12, 'Turnover/MCap 3%+')
    else if (churn >= 1) add(8, 'Turnover/MCap 1%+')
    else if (churn >= 0.3) add(4, 'Turnover/MCap 0.3%+')
  }

  // Room to upper circuit
  if (toUC !== null && !atUC) {
    if (toUC >= 14) add(5, 'UC room 14%+')
    else if (toUC >= 6) add(12, 'UC room 6-14%')
    else if (toUC >= 3) add(7, 'UC room 3-6%')
    else if (toUC >= 1) add(2, 'UC room 1-3%')
  }

  // Market-cap preference
  const capCr = (s.marketCap || 0) / CRORE
  if (capCr >= 100 && capCr < 1000) add(8, 'Cap 100-1000 Cr')
  else if (capCr >= 1000 && capCr < 5000) add(5, 'Cap 1k-5k Cr')
  else if (capCr >= 5000 && capCr < 10000) add(3, 'Cap 5k-10k Cr')
  else if (capCr >= 10000) add(1, 'Cap >10k Cr')

  // Data readiness
  if (n >= 5) add(6, '5+ snapshots')
  else if (n >= 3) add(4, '3+ snapshots')
  else if (n >= 2) add(2, '2+ snapshots')

  // Penalties
  if (atUC) add(-25, 'At upper circuit')
  if (last.vwap && last.ltp < last.vwap) add(-8, 'Below VWAP')
  if (chg30 !== null && chg30 <= -2) add(-8, '30m change <= -2pp')
  if (turnRs < CRORE) add(-10, 'Turnover < 1 Cr')
  if (toUC !== null && !atUC && toUC < 1) add(-8, 'UC room < 1%')
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
