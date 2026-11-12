// Scheduled Netlify Function: refreshes the trending-stocks snapshot.
//
// Schedule (UTC cron): every 15 minutes between 03:00 and 10:45 UTC. Runs
// inside NSE market hours (09:15–15:30 IST, IST = UTC+5:30) fetch fresh data.
// Runs after the close are cheap: `refreshTrending()` serves the cached snapshot
// and, for gainers, records the end-of-day report if the 15:30 run missed it.
//
// Uses the `schedule()` wrapper from @netlify/functions (the correct pairing
// for a legacy `export const handler`), so Netlify registers the cron.
//
// The first refresh at/after 09:00 IST starts a new trading day: every stock
// gets a fresh `createdAt`. Subsequent 15-minute refreshes update `modifiedAt`
// while preserving each stock's original `createdAt`.

import { schedule } from '@netlify/functions'
import { connectLambda } from '@netlify/blobs'
import { refreshTrending, loadHolidays } from '../../server/services/trendingService.js'

export const handler = schedule('*/15 3-10 * * *', async (event) => {
  // Legacy (v1) functions don't auto-configure Netlify Blobs; wire it in so the
  // snapshot persists durably instead of falling back to ephemeral /tmp.
  connectLambda(event)

  // Load the dynamic NSE holiday list (cached) before the market-hours checks
  // inside `refreshTrending()`. Outside market hours it never fetches or resets
  // the snapshot, so it is safe to call on every run.
  await loadHolidays()

  const results = []
  for (const type of ['gainers', 'losers']) {
    try {
      const snap = await refreshTrending(type)
      results.push({ type, count: snap.count, dayStartedAt: snap.dayStartedAt, updatedAt: snap.updatedAt })
    } catch (err) {
      console.error(`Trending refresh failed for ${type}:`, err)
      results.push({ type, error: err.message })
    }
  }

  return { statusCode: 200, body: JSON.stringify(results) }
})
