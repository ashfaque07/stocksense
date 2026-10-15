// Repository: caches NSE trading holidays (per year) fetched from the NSE
// holiday-master API, so we don't hit NSE on every check.
//
// Storage backend mirrors the other repositories:
//   - On Netlify/serverless we use Netlify Blobs (durable across cold starts).
//   - Locally we use a JSON file on disk, keyed by year.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IS_SERVERLESS } from '../config/index.js'

const __dirname = import.meta.url ? dirname(fileURLToPath(import.meta.url)) : process.cwd()

const HOLIDAY_FILE = IS_SERVERLESS
  ? '/tmp/holidays.json'
  : join(__dirname, '..', 'data', 'holidays.json')

// TODO: rename to 'stocksense' later (keeping old value to preserve existing blob data)
const BLOB_STORE = 'ipo-analyzer'
const blobKey = (year) => `holidays:${year}`

async function getBlobStore() {
  if (!IS_SERVERLESS) return null
  // Not memoized: a cached store on a warm Lambda holds a request-scoped token
  // that expires ("Token expired").
  try {
    const { getStore } = await import('@netlify/blobs')
    return getStore(BLOB_STORE)
  } catch {
    return null
  }
}

// Returns the cached holiday entry for a year, or null. Shape:
// { fetchedAt: ISOString, dates: ['YYYY-MM-DD', ...] }
export async function readHolidays(year) {
  const blobs = await getBlobStore()
  if (blobs) {
    try {
      return (await blobs.get(blobKey(year), { type: 'json' })) || null
    } catch {
      return null
    }
  }

  try {
    const all = JSON.parse(await readFile(HOLIDAY_FILE, 'utf8'))
    return all?.[year] || null
  } catch {
    return null
  }
}

export async function writeHolidays(year, entry) {
  const blobs = await getBlobStore()
  if (blobs) {
    await blobs.setJSON(blobKey(year), entry)
    return
  }

  let all = {}
  try {
    all = JSON.parse(await readFile(HOLIDAY_FILE, 'utf8')) || {}
  } catch {
    /* first write */
  }
  all[year] = entry
  await mkdir(dirname(HOLIDAY_FILE), { recursive: true })
  await writeFile(HOLIDAY_FILE, JSON.stringify(all, null, 2), 'utf8')
}
