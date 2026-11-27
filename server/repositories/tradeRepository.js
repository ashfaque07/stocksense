// Repository: auto-trade orders and settings in Netlify Database (Postgres/Neon).
//
// Connection: `@netlify/neon` reads NETLIFY_DATABASE_URL (set automatically on
// Netlify). For local runs set NETLIFY_DATABASE_URL or DATABASE_URL in .env.

import { neon } from '@netlify/neon'

let schemaReady = null

function getSql() {
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Database not configured (NETLIFY_DATABASE_URL missing).')
  return neon(url)
}

async function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS trade_orders (
          id SERIAL PRIMARY KEY,
          trade_date TEXT NOT NULL,
          symbol TEXT NOT NULL,
          instrument_key TEXT,
          mode TEXT NOT NULL,
          status TEXT NOT NULL,
          qty INTEGER NOT NULL,
          entry_price NUMERIC,
          entry_order_id TEXT,
          entry_time TIMESTAMPTZ DEFAULT now(),
          sl_price NUMERIC,
          target_price NUMERIC,
          exit_price NUMERIC,
          exit_order_id TEXT,
          exit_time TIMESTAMPTZ,
          exit_reason TEXT,
          pnl NUMERIC,
          signal JSONB,
          error TEXT,
          UNIQUE (trade_date, symbol)
        )`
      await sql`
        CREATE TABLE IF NOT EXISTS trade_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT now()
        )`
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  await schemaReady
}

async function db() {
  const sql = getSql()
  await ensureSchema(sql)
  return sql
}

// Reserve (trade_date, symbol). Returns the new row id, or null when a trade
// for that symbol already exists today (also guards against concurrent runs).
export async function reserveTrade(t) {
  const sql = await db()
  const rows = await sql`
    INSERT INTO trade_orders (trade_date, symbol, instrument_key, mode, status, qty, entry_price, sl_price, target_price, signal)
    VALUES (${t.tradeDate}, ${t.symbol}, ${t.instrumentKey}, ${t.mode}, 'PENDING', ${t.qty}, ${t.entryPrice}, ${t.slPrice}, ${t.targetPrice}, ${JSON.stringify(t.signal)})
    ON CONFLICT (trade_date, symbol) DO NOTHING
    RETURNING id`
  return rows[0]?.id ?? null
}

export async function markEntry(id, { status, entryOrderId, entryPrice, qty, error }) {
  const sql = await db()
  await sql`
    UPDATE trade_orders
    SET status = ${status}, entry_order_id = ${entryOrderId ?? null},
        entry_price = COALESCE(${entryPrice ?? null}, entry_price),
        qty = COALESCE(${qty ?? null}, qty), error = ${error ?? null}
    WHERE id = ${id}`
}

export async function markExit(id, { exitPrice, exitOrderId, reason, pnl, error }) {
  const sql = await db()
  await sql`
    UPDATE trade_orders
    SET status = 'CLOSED', exit_price = ${exitPrice}, exit_order_id = ${exitOrderId ?? null},
        exit_reason = ${reason}, exit_time = now(), pnl = ${pnl}, error = ${error ?? null}
    WHERE id = ${id}`
}

export async function listOpenTrades() {
  const sql = await db()
  return sql`SELECT * FROM trade_orders WHERE status = 'OPEN' ORDER BY id`
}

export async function countTradesForDate(tradeDate) {
  const sql = await db()
  const rows = await sql`
    SELECT count(*)::int AS n FROM trade_orders
    WHERE trade_date = ${tradeDate} AND status IN ('PENDING', 'OPEN', 'CLOSED')`
  return rows[0].n
}

export async function listTrades(limit = 200) {
  const sql = await db()
  return sql`SELECT * FROM trade_orders ORDER BY id DESC LIMIT ${limit}`
}

export async function getSetting(key) {
  const sql = await db()
  const rows = await sql`SELECT value FROM trade_settings WHERE key = ${key}`
  return rows[0]?.value ?? null
}

export async function setSetting(key, value) {
  const sql = await db()
  await sql`
    INSERT INTO trade_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
}
