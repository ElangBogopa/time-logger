/**
 * Simple client-side cache with optional TTL.
 * Module-level Map persists across component mounts within the same page session.
 * Data is cleared on full page reload (which is fine — it's a cache, not storage).
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cacheStore = new Map<string, CacheEntry<unknown>>()

/**
 * Get a cached value. Returns undefined if not found or expired.
 */
export function cacheGet<T>(key: string, ttlMs?: number): T | undefined {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined
  if (!entry) return undefined
  if (ttlMs && Date.now() - entry.timestamp > ttlMs) {
    cacheStore.delete(key)
    return undefined
  }
  return entry.data
}

/**
 * Set a cached value.
 */
export function cacheSet<T>(key: string, data: T): void {
  cacheStore.set(key, { data, timestamp: Date.now() })
}

/**
 * Check if a key exists (and is not expired).
 */
export function cacheHas(key: string, ttlMs?: number): boolean {
  return cacheGet(key, ttlMs) !== undefined
}

/**
 * Delete a cached value.
 */
export function cacheDelete(key: string): void {
  cacheStore.delete(key)
}

/**
 * Clear all cached values.
 */
export function cacheClear(): void {
  cacheStore.clear()
}
