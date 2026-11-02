/**
 * Shared store for AI-generated text that should only be regenerated when its
 * inputs change.
 *
 * Every AI surface in the app had the same two problems: the cache was a
 * module-level Map, so a page reload regenerated the text, and it was keyed on
 * a date rather than on the data, so a real change reused a stale line. This
 * keys on a fingerprint of the prompt inputs and persists in localStorage.
 *
 * Namespaces keep the surfaces apart ('day', 'week'), each pruned on its own.
 */

const STORAGE_KEY = 'ai-text-cache-v1'
const KEEP_PER_NAMESPACE = 7

interface Entry {
  fingerprint: string
  text: string
}
type Store = Record<string, Record<string, Entry>>

/** djb2 — short, stable, and enough to tell two sets of inputs apart. */
export function stableHash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    // private mode, blocked storage, or corrupt JSON — behave as a cold cache
    return {}
  }
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed: Store = {}
    for (const ns of Object.keys(store)) {
      const keys = Object.keys(store[ns]).sort().slice(-KEEP_PER_NAMESPACE)
      trimmed[ns] = {}
      for (const k of keys) trimmed[ns][k] = store[ns][k]
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // out of quota or storage blocked — this is an optimisation, not state
  }
}

/** The stored text for this key, but only if the inputs still match. */
export function readCachedText(namespace: string, key: string, fingerprint: string): string | null {
  const entry = readStore()[namespace]?.[key]
  if (!entry || entry.fingerprint !== fingerprint) return null
  return entry.text || null
}

export function writeCachedText(namespace: string, key: string, fingerprint: string, text: string): void {
  if (!text) return // nothing worth remembering; let the next visit retry
  const store = readStore()
  store[namespace] = { ...(store[namespace] ?? {}), [key]: { fingerprint, text } }
  writeStore(store)
}

/** The fingerprint stored for this key, whatever it is — used to tell the server what we already have. */
export function storedFingerprint(namespace: string, key: string): string | null {
  return readStore()[namespace]?.[key]?.fingerprint ?? null
}

export function clearCachedText(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to do
  }
}
