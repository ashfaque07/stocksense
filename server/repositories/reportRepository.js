// Repository: persists the end-of-day top-gainers report as a flat, append-only
// list of records (one per stock per trading day).
//
// Storage backend mirrors the trending repository:
//   - On Netlify/serverless we use Netlify Blobs (durable across cold starts).
//   - Locally we use a JSON file on disk.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { REPORT_FILE, IS_SERVERLESS } from '../config/index.js'

// Same blob store as the trending snapshot (see trendingRepository.js).
const BLOB_STORE = 'ipo-analyzer'
const BLOB_KEY = 'report:top-gainers'

// Created fresh on every call (not memoized) to avoid expired request-scoped
// tokens on warm Lambdas. Returns null when Blobs is unavailable.
async function getBlobStore() {
  if (!IS_SERVERLESS) return null
  try {
    const { getStore } = await import('@netlify/blobs')
    return getStore(BLOB_STORE)
  } catch (err) {
    console.error('[report] Netlify Blobs unavailable, using ephemeral /tmp:', err?.message)
    return null
  }
}

// Returns the stored records array (empty when nothing has been saved yet).
export async function readReport() {
  const blobs = await getBlobStore()
  if (blobs) {
    try {
      const data = await blobs.get(BLOB_KEY, { type: 'json' })
      return Array.isArray(data?.records) ? data.records : []
    } catch (err) {
      console.error('[report] Blob read failed:', err?.message)
      return []
    }
  }

  try {
    const data = JSON.parse(await readFile(REPORT_FILE, 'utf8'))
    return Array.isArray(data?.records) ? data.records : []
  } catch {
    return []
  }
}

export async function writeReport(records) {
  const payload = { updatedAt: new Date().toISOString(), count: records.length, records }

  const blobs = await getBlobStore()
  if (blobs) {
    try {
      await blobs.setJSON(BLOB_KEY, payload)
      return
    } catch (err) {
      console.error('[report] Blob write failed:', err?.message)
      throw err
    }
  }

  await mkdir(dirname(REPORT_FILE), { recursive: true })
  await writeFile(REPORT_FILE, JSON.stringify(payload, null, 2), 'utf8')
}
