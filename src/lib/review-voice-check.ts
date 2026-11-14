/**
 * The rules a day or week review line can be checked against without a model.
 *
 * Used by tests and by scripts/eval/review-voice.eval.ts only. It is not run
 * in the routes: a check there would mean dropping or regenerating lines for
 * real people, which is a separate decision.
 */

import { REVIEW_BANNED_WORDS } from '@/lib/prompts'

export interface VoiceBreach {
  rule: string
  found: string
}

export const REVIEW_VERDICT_WORDS = [
  'strong',
  'productive',
  'unproductive',
  'successful',
  'excellent',
  'well-rounded',
  'balanced',
  'struggled',
  'neglected',
  'lacking',
  'fell short',
  'room for improvement',
] as const

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-word matcher; `\b` does not sit well beside "/" so those use plain matching. */
function wordRegex(words: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${words.map(escape).join('|')})\\b`, 'gi')
}

function findAll(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re)).map((m) => m[0])
}

const BANNED = wordRegex(REVIEW_BANNED_WORDS)
const VERDICT = wordRegex(REVIEW_VERDICT_WORDS)
const SCORE_TALK = /\/100|\bout of 100\b|\bscores?\b|\bscored\b/gi
const RELATIVE_DAY = wordRegex(['today', 'yesterday', 'tomorrow'])
const ADVICE = wordRegex(['should', 'try', 'consider', 'aim', 'next time', 'need to'])
const CORRECTION = wordRegex(['should', 'need to', 'must'])
const HARD_DAY = wordRegex(['tough', 'challenging', 'difficult', 'rough'])
const EMOJI = /\p{Extended_Pictographic}/gu
// "No time with people was logged", "no social time", "no calls were logged".
const NO_PEOPLE =
  /\bno (?:time |hours? )?(?:with (?:people|others|friends|family)|social(?: time| activit(?:y|ies))?|calls?)\b|\b(?:time with people|social time) was not\b/gi

export function checkReviewLine(
  text: string,
  opts: {
    kind: 'day' | 'week'
    mood?: 'low' | 'okay' | 'great' | null
    /** Minutes of Social and Calls in the input, when known. */
    peopleMinutes?: number
  }
): VoiceBreach[] {
  const breaches: VoiceBreach[] = []
  const add = (rule: string, found: string[]) => {
    for (const f of found) breaches.push({ rule, found: f })
  }

  if (text.trim().length === 0) return [{ rule: 'empty', found: '' }]

  add('banned-word', findAll(text, BANNED))
  add('verdict', findAll(text, VERDICT))
  add('exclamation', findAll(text, /!/g))
  add('question', findAll(text, /\?/g))
  add('emoji', findAll(text, EMOJI))
  add('score-talk', findAll(text, SCORE_TALK))

  // Only checkable when the caller knows the input: a line that says nobody
  // was seen on a day that has time with people in it.
  if ((opts.peopleMinutes ?? 0) > 0) add('false-absence', findAll(text, NO_PEOPLE))

  if (opts.kind === 'day') {
    add('relative-day', findAll(text, RELATIVE_DAY))
    add('advice', findAll(text, ADVICE))
    if (opts.mood !== 'low') add('hard-day', findAll(text, HARD_DAY))
  } else {
    add('correction', findAll(text, CORRECTION))
  }

  const sentences = findAll(text, /[.!?](?=\s+\S|\s*$)/g).length
  const limit = opts.kind === 'day' ? 3 : 4
  if (sentences > limit) breaches.push({ rule: 'too-long', found: `${sentences} sentences` })

  for (const line of text.split('\n')) {
    if (/^\s*(?:-|•|\d+\.)/.test(line)) {
      breaches.push({ rule: 'list', found: line.trim() })
      break
    }
  }

  return breaches
}
