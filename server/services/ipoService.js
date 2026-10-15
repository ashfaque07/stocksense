// Service layer: fetches and normalizes IPO data from InvestorGain.

import { REPORT_REFERER } from '../config/index.js'
import { normalizeRow } from '../models/ipo.js'
import { buildUrl } from '../utils/parsers.js'

async function fetchLiveRows() {
  const tryUrls = [buildUrl(new Date())]
  // Fallback: previous month in case the current month has no rows yet.
  const prev = new Date()
  prev.setMonth(prev.getMonth() - 1)
  tryUrls.push(buildUrl(prev))

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          Referer: REPORT_REFERER,
          Accept: 'application/json'
        }
      })
      if (!res.ok) continue
      const json = await res.json()
      const rows = json.reportTableData
      if (Array.isArray(rows) && rows.length) {
        return rows.map(normalizeRow)
      }
    } catch (err) {
      // try next url
    }
  }
  return null
}

export async function getIpos() {
  const live = await fetchLiveRows()

  if (live) {
    return { source: 'live', count: live.length, ipos: live }
  }

  return {
    source: 'error',
    count: 0,
    ipos: [],
    error: 'Could not fetch IPO data from InvestorGain.'
  }
}
