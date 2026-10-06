// Proxy server entry point: fetches the InvestorGain "Live IPO GMP" report and
// returns normalized JSON. The browser can't call InvestorGain directly (CORS),
// so this small Node server does the fetching/parsing server-side.
//
// Run with: npm run server   (needs Node 18+ for global fetch)

import 'dotenv/config'
import http from 'node:http'
import { PORT, REPORT_ID } from './config/index.js'
import { router } from './routes/router.js'

const server = http.createServer(router)

server.listen(PORT, () => {
  console.log(`StockSense proxy running at http://localhost:${PORT}/api/ipos`)
  console.log(`Source: InvestorGain Live IPO GMP (report ${REPORT_ID})`)
})
