// Proxy server entry point: fetches third-party stock/IPO data (InvestorGain,
// NSE, Yahoo Finance) and returns normalized JSON, plus AI analysis endpoints.
// The browser can't call these sources directly (CORS), so this small Node
// server does the fetching/parsing server-side.
//
// Run with: npm run server   (needs Node 18+ for global fetch)

import 'dotenv/config'
import http from 'node:http'
import { PORT } from './config/index.js'
import { router } from './routes/router.js'

const server = http.createServer(router)

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} already in use — is another server running?`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`StockSense proxy running at http://localhost:${PORT}`)
  console.log('Sources: InvestorGain (IPOs), NSE (trending/results), Yahoo Finance (quarterlies)')
})
