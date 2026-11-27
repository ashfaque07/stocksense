// Scheduled Netlify Function: runs the auto-trade cycle every minute.
//
// Cron is UTC; 03-09 UTC covers the NSE session (09:15-15:30 IST). The cycle
// itself is gated on market hours/holidays. Requires AUTO_TRADE_ENABLED=true.
// Trades are simulated unless AUTO_TRADE_MODE=live.

import { schedule } from '@netlify/functions'
import { connectLambda } from '@netlify/blobs'
import { AUTO_TRADE } from '../../server/config/index.js'
import { runCycle } from '../../server/services/tradeService.js'
import { ensureFreshToken } from '../../server/services/upstoxAuthService.js'

export const handler = schedule('* 3-9 * * 1-5', async (event) => {
  connectLambda(event)

  if (!AUTO_TRADE.enabled) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'AUTO_TRADE_ENABLED is not true' }) }
  }

  try {
    await ensureFreshToken()
    const out = await runCycle()
    if (out.results?.length) console.log('[trade]', JSON.stringify(out.results))
    return { statusCode: 200, body: JSON.stringify(out) }
  } catch (err) {
    console.error('[trade] scheduled run failed:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
})
