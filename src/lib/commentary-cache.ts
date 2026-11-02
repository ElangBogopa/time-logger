/**
 * Persistent cache for the day review's AI commentary.
 *
 * The generic client-cache is a module-level Map, so it dies on every full
 * page load — reopening the PWA regenerated the commentary even when the day
 * had not changed. It was also keyed on the date alone, so within a session
 * the opposite happened: log a new entry and the stale line was reused.
 *
 * This keys on a fingerprint of exactly the fields that go into the prompt, and
 * stores it in localStorage. Same day, same data → same text, no API call;
 * anything that would change the prompt produces a new key and one new call.
 */

const STORAGE_KEY = 'day-commentary-cache-v1'
const KEEP_DAYS = 7

export interface CommentaryInputs {
  date: string
  score: number
  totalMinutesLogged: number
  wins: { id?: string; text?: string }[]
  mood?: string | null
  longestFocusSession?: { activity: string; minutes: number } | null
}

type Store = Record<string, { fingerprint: string; commentary: string }>

/** djb2 — short, stable, and enough to tell two days' inputs apart. */
function hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * A fingerprint of the prompt inputs. Anything the model is told about must be
 * in here, or a real change would silently reuse the old commentary.
 */
export function commentaryFingerprint(inputs: CommentaryInputs): string {
  return hash(
    JSON.stringify([
      inputs.score,
      inputs.totalMinutesLogged,
      (inputs.wins ?? []).map((w) => w.id ?? w.text ?? ''),
      inputs.mood ?? null,
      inputs.longestFocusSession
        ? [inputs.longestFocusSession.activity, inputs.longestFocusSession.minutes]
        : null,
    ])
  )
}

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    // private mode, blocked storage, or corrupt JSON — behave as a cold cache
    return {}
  }
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return
  try {
    // keep the most recent days only, so this cannot grow without bound
    const trimmed: Store = {}
    for (const date of Object.keys(store).sort().slice(-KEEP_DAYS)) trimmed[date] = store[date]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // out of quota or storage blocked — the cache is an optimisation, not state
  }
}

/** The stored commentary for this day, but only if the day's data still matches. */
export function readCachedCommentary(date: string, fingerprint: string): string | null {
  const entry = readStore()[date]
  if (!entry || entry.fingerprint !== fingerprint) return null
  return entry.commentary || null
}

export function writeCachedCommentary(date: string, fingerprint: string, commentary: string): void {
  if (!commentary) return // nothing worth remembering; let the next visit retry
  const store = readStore()
  store[date] = { fingerprint, commentary }
  writeStore(store)
}

export function clearCachedCommentary(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to do
  }
}
