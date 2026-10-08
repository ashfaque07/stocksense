// Ad-hoc AI model health check. Two modes share one runner so every
// environment is tested and reported identically.
//
// DIRECT MODE (default): pings each model from the local .env DIRECTLY against
// its provider (no app, no fallback), so a broken model is reported as FAIL
// instead of being masked by the app's cross-model fallback:
//   node server/scripts/testModels.js
//
// DEPLOYED MODE: exercises the REAL deployed API end-to-end through the Netlify
// function, hitting GET /api/models then POST /api/analyze-stock per model.
// Target a known environment by name, or pass a custom URL:
//   node server/scripts/testModels.js --prod        # production
//   node server/scripts/testModels.js --stage       # stage branch deploy
//   node server/scripts/testModels.js --env=stage   # equivalent
//   node server/scripts/testModels.js --url=https://custom--site.netlify.app
//   PROD_URL=https://custom.netlify.app node server/scripts/testModels.js

import 'dotenv/config'
import { AI_MODELS } from '../config/index.js'

const TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45000

const PROMPT = [
  { role: 'system', content: 'You are a health-check. Reply with exactly: OK' },
  { role: 'user', content: 'Say OK.' }
]

// Known deployment targets. Override any via env (PROD_SITE_URL / STAGE_SITE_URL).
const ENV_URLS = {
  prod: process.env.PROD_SITE_URL || 'https://stocksense1-ai.netlify.app',
  stage: process.env.STAGE_SITE_URL || 'https://stage--stocksense1-ai.netlify.app'
}

// Resolve the deployed base URL to test (empty = direct provider mode).
// Precedence: --url=/--prod=<url> > --env=<name> > --prod/--stage flag > PROD_URL env.
function resolveDeployedUrl(argv) {
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

// fetch() with a shared timeout. Returns { res, ms } or throws a normalized
// error carrying the elapsed ms so callers don't re-implement timing/abort.
async function timedFetch(url, options) {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return { res, ms: Date.now() - start }
  } catch (err) {
    const message = err.name === 'AbortError'
      ? `timed out after ${TIMEOUT_MS}ms`
      : (err.cause?.message || err.cause?.code || err.message)
    throw Object.assign(new Error(message), { ms: Date.now() - start })
  } finally {
    clearTimeout(timer)
  }
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

// A "target" describes an environment via two capabilities — list its models
// and test one — both yielding the same result shape:
//   { model, provider, ok, ms, reply }
// The shared runner below handles timing display, looping and reporting, so the
// output is identical for every environment.

// Direct-against-provider target (local .env models, no app, no fallback).
function directTarget() {
  return {
    label: `local .env — ${AI_MODELS.length} configured model(s)`,
    listModels: () => AI_MODELS,
    describe: (m) => `${m.model} (${m.provider})`,
    async testModel({ model, provider, apiKey, baseUrl }) {
      try {
        const { res, ms } = await timedFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: PROMPT, temperature: 0, stream: false })
        })
        if (!res.ok) {
          const detail = clean(await res.text().catch(() => '')).slice(0, 120)
          return { model, provider, ok: false, ms, reply: `HTTP ${res.status}: ${detail}` }
        }
        const data = await res.json()
        const reply = clean(data.choices?.[0]?.message?.content).slice(0, 40)
        if (!reply) return { model, provider, ok: false, ms, reply: 'empty response' }
        return { model, provider, ok: true, ms, reply }
      } catch (err) {
        return { model, provider, ok: false, ms: err.ms ?? 0, reply: err.message }
      }
    }
  }
}

// Deployed-app target (end-to-end through the Netlify function). NOTE: this goes
// through /api/analyze-stock, which has cross-model fallback, so a PASS proves
// the pipeline works — not necessarily that this exact model served the reply.
function deployedTarget(baseUrl) {
  return {
    label: `deployed app at ${baseUrl}`,
    describe: (m) => m.model,
    async listModels() {
      const { res } = await timedFetch(`${baseUrl}/api/models`, {})
      if (!res.ok) throw new Error(`GET /api/models — HTTP ${res.status}`)
      const data = await res.json()
      const models = Array.isArray(data.models) ? data.models : []
      // Normalize to the same { model, provider } shape used by direct mode.
      return models.map((model) => ({ model, provider: 'deployed' }))
    },
    async testModel({ model, provider }) {
      try {
        const { res, ms } = await timedFetch(`${baseUrl}/api/analyze-stock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'RELIANCE', model })
        })
        const text = clean(await res.text().catch(() => ''))
        if (!res.ok) {
          return { model, provider, ok: false, ms, reply: `HTTP ${res.status}: ${text.slice(0, 120)}` }
        }
        // The controller writes "[Analysis failed: ...]" into the stream on error.
        if (/\[Analysis failed:/i.test(text)) {
          return { model, provider, ok: false, ms, reply: text.slice(0, 160) }
        }
        if (!text) return { model, provider, ok: false, ms, reply: 'empty response' }
        return { model, provider, ok: true, ms, reply: text.slice(0, 40) }
      } catch (err) {
        return { model, provider, ok: false, ms: err.ms ?? 0, reply: err.message }
      }
    }
  }
}

// Shared runner: list models, test each, print identical results for any target.
async function run(target) {
  console.log(`Testing ${target.label}...\n`)

  let models
  try {
    models = await target.listModels()
  } catch (err) {
    console.error(`Failed to list models — ${err.message}`)
    process.exit(1)
  }

  if (!models.length) {
    console.error('No models to test. Check *_API_KEY/*_MODELS (local) or Netlify env vars (deployed).')
    process.exit(1)
  }

  const results = []
  for (const m of models) {
    process.stdout.write(`- ${target.describe(m)}... `)
    const r = await target.testModel(m)
    console.log(r.ok ? `OK ${r.ms}ms` : `FAIL ${r.ms}ms`)
    results.push(r)
  }

  console.log('\nResults:')
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL'
    console.log(`  [${status}] ${target.describe(r)} — ${r.ms}ms — ${r.reply}`)
  }

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} model(s) working.`)
  process.exit(passed === results.length ? 0 : 1)
}

const deployedUrl = resolveDeployedUrl(process.argv).replace(/\/+$/, '')
run(deployedUrl ? deployedTarget(deployedUrl) : directTarget())
