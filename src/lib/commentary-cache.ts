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
 *
 * The storage itself lives in ai-text-cache, shared with the weekly review.
 */

import { readCachedText, writeCachedText, clearCachedText, stableHash } from './ai-text-cache'

const NAMESPACE = 'day'

export interface CommentaryInputs {
  date: string
  score: number
  totalMinutesLogged: number
  wins: { id?: string; text?: string }[]
  mood?: string | null
  longestFocusSession?: { activity: string; minutes: number } | null
}

/**
 * A fingerprint of the prompt inputs. Anything the model is told about must be
 * in here, or a real change would silently reuse the old commentary.
 */
export function commentaryFingerprint(inputs: CommentaryInputs): string {
  return stableHash(
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

/** The stored commentary for this day, but only if the day's data still matches. */
export function readCachedCommentary(date: string, fingerprint: string): string | null {
  return readCachedText(NAMESPACE, date, fingerprint)
}

export function writeCachedCommentary(date: string, fingerprint: string, commentary: string): void {
  writeCachedText(NAMESPACE, date, fingerprint, commentary)
}

export function clearCachedCommentary(): void {
  clearCachedText()
}
