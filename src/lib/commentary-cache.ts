/**
 * Persistent cache for the day review's AI commentary.
 *
 * The generic client-cache is a module-level Map, so it dies on every full
 * page load — reopening the PWA regenerated the commentary even when the day
 * had not changed. It was also keyed on the date alone, so within a session
 * the opposite happened: log a new entry and the stale line was reused.
 *
 * This keys on a fingerprint of exactly what goes into the prompt — the
 * read's rule and facts — and stores it in localStorage. Same day, same data → same text, no API call;
 * anything that would change the prompt produces a new key and one new call.
 *
 * The storage itself lives in ai-text-cache, shared with the weekly review.
 */

import { readCachedText, writeCachedText, clearCachedText, stableHash } from './ai-text-cache'

const NAMESPACE = 'day'

// Raise this when the prompt's voice changes, so lines written by the old prompt are not reused.
const PROMPT_VERSION = 8

/**
 * A fingerprint of what the model is told: the read's rule and its facts.
 * The facts are written from the log, so anything that changes them — a new
 * entry, an edited one — produces a new key and one new call.
 */
export function readFingerprint(read: { rule: string; facts: string[] }): string {
  return stableHash(JSON.stringify([PROMPT_VERSION, read.rule, read.facts]))
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
