// Ad-hoc health check: pings every configured AI model DIRECTLY (no fallback)
// with a tiny prompt and reports pass/fail, latency and provider. Run with:
//   node server/scripts/testModels.js
//
// Each model is hit in isolation (bypassing the app's cross-model fallback) so a
// broken model is reported as FAIL instead of being masked by a working one.

import 'dotenv/config'
import { AI_MODELS } from '../config/index.js'

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

async function main() {
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
