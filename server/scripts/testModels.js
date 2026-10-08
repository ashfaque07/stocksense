// Ad-hoc health check: pings every configured AI model DIRECTLY (no fallback)
// with a tiny prompt and reports pass/fail, latency and provider. Run with:
//   node server/scripts/testModels.js
//
// Each model is hit in isolation (bypassing the app's cross-model fallback) so a
// broken model is reported as FAIL instead of being masked by a working one.
//
// PROD MODE: exercise the REAL deployed API (a true end-to-end test through the
// Netlify function), hitting GET /api/models then POST /api/analyze-stock per
// model. Target a known environment by name, or pass a custom URL:
//   node server/scripts/testModels.js --prod        # production
//   node server/scripts/testModels.js --stage       # stage branch deploy
//   node server/scripts/testModels.js --env=stage   # equivalent
//   node server/scripts/testModels.js --url=https://custom--site.netlify.app
//   PROD_URL=https://custom.netlify.app node server/scripts/testModels.js

import 'dotenv/config'
import { AI_MODELS } from '../config/index.js'

// Known deployment targets. Override any via env (PROD_SITE_URL / STAGE_SITE_URL).
const ENV_URLS = {
  prod: process.env.PROD_SITE_URL || 'https://stocksense1-ai.netlify.app',
  stage: process.env.STAGE_SITE_URL || 'https://stage--stocksense1-ai.netlify.app'
}

// Resolve the deployed base URL to test (empty = direct provider mode).
// Precedence: --url=/--prod=<url> > --env=<name> > --prod/--stage flag > PROD_URL env.
function resolveProdUrl(argv) {
  const custom = argv.find((a) => a.startsWith('--url=') || a.startsWith('--prod='))
  if (custom) return custom.slice(custom.indexOf('=') + 1)

  const envArg = argv.find((a) => a.startsWith('--env='))?.slice('--env='.length)
  const flag = argv.includes('--stage') ? 'stage' : argv.includes('--prod') ? 'prod' : ''
  const name = envArg || flag
  if (name) {
    if (!ENV_URLS[name]) {
      console.error(`Unknown env "${name}". Known: ${Object.keys(ENV_URLS).join(', ')}.`)
      process.exit(1)
    }
    return ENV_URLS[name]
  }

  return process.env.PROD_URL || ''
}

const PROD_URL = resolveProdUrl(process.argv).replace(/\/+$/, '')

const PROMPT = [
  { role: 'system', content: 'You are a health-check. Reply with exactly: OK' },
  { role: 'user', content: 'Say OK.' }
]

const TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45000

async function testModel({ model, provider, apiKey, baseUrl }) {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages: PROMPT, temperature: 0, stream: false }),
      signal: controller.signal
    })
    const ms = Date.now() - start
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)
      return { model, provider, ok: false, ms, reply: `HTTP ${res.status}: ${detail}` }
    }
    const data = await res.json()
    const reply = (data.choices?.[0]?.message?.content || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!reply) return { model, provider, ok: false, ms, reply: 'empty response' }
    return { model, provider, ok: true, ms, reply }
  } catch (err) {
    const ms = Date.now() - start
    const reason = err.name === 'AbortError'
      ? `timed out after ${TIMEOUT_MS}ms`
      : (err.cause?.message || err.cause?.code || err.message)
    return { model, provider, ok: false, ms, reply: reason }
  } finally {
    clearTimeout(timer)
  }
}

// Hits the DEPLOYED app's streaming endpoint for a single model (true prod
// round-trip through the Netlify function), reading the text/plain stream the
// controller writes. A failed model surfaces as the controller's error marker.
async function testModelProd(model) {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${PROD_URL}/api/analyze-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'RELIANCE', model }),
      signal: controller.signal
    })
    const ms = Date.now() - start
    const text = (await res.text().catch(() => '')).replace(/\s+/g, ' ').trim()
    if (!res.ok) {
      return { model, provider: 'prod', ok: false, ms, reply: `HTTP ${res.status}: ${text.slice(0, 120)}` }
    }
    // The controller writes "[Analysis failed: ...]" into the stream on error.
    if (/\[Analysis failed:/i.test(text)) {
      return { model, provider: 'prod', ok: false, ms, reply: text.slice(0, 160) }
    }
    if (!text) return { model, provider: 'prod', ok: false, ms, reply: 'empty response' }
    return { model, provider: 'prod', ok: true, ms, reply: text.slice(0, 40) }
  } catch (err) {
    const ms = Date.now() - start
    const reason = err.name === 'AbortError'
      ? `timed out after ${TIMEOUT_MS}ms`
      : (err.cause?.message || err.cause?.code || err.message)
    return { model, provider: 'prod', ok: false, ms, reply: reason }
  } finally {
    clearTimeout(timer)
  }
}

async function runProd() {
  console.log(`Testing DEPLOYED app at ${PROD_URL}...\n`)

  // Discover the models the deployed app actually has configured.
  let models
  try {
    const res = await fetch(`${PROD_URL}/api/models`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    models = Array.isArray(data.models) ? data.models : []
  } catch (err) {
    console.error(`Failed to fetch ${PROD_URL}/api/models — ${err.message}`)
    process.exit(1)
  }

  if (!models.length) {
    console.error('Deployed app reports no configured models. Check Netlify env vars.')
    process.exit(1)
  }

  console.log(`Deployed app exposes ${models.length} model(s).\n`)

  const results = []
  for (const model of models) {
    process.stdout.write(`- ${model}... `)
    const r = await testModelProd(model)
    console.log(r.ok ? `OK ${r.ms}ms` : `FAIL ${r.ms}ms`)
    results.push(r)
  }

  console.log('\nResults:')
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL'
    console.log(`  [${status}] ${r.model} — ${r.ms}ms — ${r.reply}`)
  }

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} model(s) working on ${PROD_URL}.`)
  process.exit(passed === results.length ? 0 : 1)
}

async function main() {
  if (PROD_URL) {
    await runProd()
    return
  }

  if (!AI_MODELS.length) {
    console.error('No AI models configured. Set *_API_KEY and *_MODELS in .env.')
    process.exit(1)
  }

  console.log(`Testing ${AI_MODELS.length} configured model(s) directly...\n`)

  const results = []
  for (const m of AI_MODELS) {
    process.stdout.write(`- ${m.model} (${m.provider})... `)
    const r = await testModel(m)
    console.log(r.ok ? `OK ${r.ms}ms` : `FAIL ${r.ms}ms`)
    results.push(r)
  }

  console.log('\nResults:')
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL'
    console.log(`  [${status}] ${r.model} (${r.provider}) — ${r.ms}ms — ${r.reply}`)
  }

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} model(s) working.`)
  process.exit(passed === results.length ? 0 : 1)
}

main()
