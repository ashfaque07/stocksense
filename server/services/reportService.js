// Service layer: end-of-day "top gainers" report.
//
// At the last market call (15:30 IST) the top N gainers from the trending
// snapshot are appended to a persisted list. Each trading day adds a new batch
// next to the previous ones; re-capturing the same date replaces that day's
// batch, so the operation is idempotent.

import { TOP_GAINERS_REPORT_COUNT } from '../config/index.js'
import { readReport, writeReport } from '../repositories/reportRepository.js'

// True when a report batch already exists for the given IST date (YYYY-MM-DD).
export async function hasReportForDate(date) {
  const records = await readReport()
  return records.some((r) => r.date === date)
}

// Pick the top N gainers (by % change) from `stocks`, ignoring stale rows, and
// append them to the report under `date`. Every stock field is kept, including
// the intraday `history`, so the stored JSON holds all values.
export async function captureTopGainers(stocks, date, capturedAt = new Date().toISOString()) {
  const top = (stocks || [])
    .filter((s) => !s.stale && Number.isFinite(Number(s.percentChange)))
    .sort((a, b) => Number(b.percentChange) - Number(a.percentChange))
    .slice(0, TOP_GAINERS_REPORT_COUNT)

  if (!top.length) return []

  const batch = top.map((s, i) => ({ date, rank: i + 1, capturedAt, ...s }))
  const existing = await readReport()
  await writeReport([...existing.filter((r) => r.date !== date), ...batch])
  console.log(`[report] captured top ${batch.length} gainers for ${date}`)
  return batch
}

// All stored report records, newest day first (rank ascending within a day).
export async function getReport() {
  const records = await readReport()
  records.sort((a, b) => (a.date === b.date ? a.rank - b.rank : a.date < b.date ? 1 : -1))
  return { source: 'cache', count: records.length, records }
}
