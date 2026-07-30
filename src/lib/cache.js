// Tiny IndexedDB cache so the dashboard opens instantly from local data and
// only re-fetches from Supabase when the cache is stale (or on manual refresh).

const DB_NAME = 'medipol-analytics'
const STORE = 'cache'
const VERSION = 1

export const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getCached(key) {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const rq = tx.objectStore(STORE).get(key)
      rq.onsuccess = () => resolve(rq.result || null)
      rq.onerror = () => reject(rq.error)
    })
  } catch {
    return null
  }
}

export async function setCached(key, data, ts) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ ts, data }, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Cache is best-effort; ignore quota/other errors.
  }
}

export function isFresh(entry, now) {
  return !!entry && now - entry.ts < CACHE_TTL
}
