/**
 * The rules a day or week review line can be checked against without a model.
 *
 * Used by tests and by scripts/eval/review-voice.eval.ts only. It is not run
 * in the routes: a check there would mean dropping or regenerating lines for
 * real people, which is a separate decision.
 */

import { REVIEW_BANNED_WORDS, REVIEW_DATA_LABELS } from '@/lib/prompts'
import { CATEGORY_LABELS } from '@/lib/types'
import type { ReadKind } from '@/lib/review-read'

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
const NOTHING_ADVICE = wordRegex(['should', 'try', 'consider', 'aim', 'next time', 'need to', 'could', 'option', 'plan'])
const CAUSE = wordRegex(['because', 'thanks to', 'leads to', 'led to', 'caused', 'as a result'])
const HARD_DAY = wordRegex(['tough', 'challenging', 'difficult', 'rough'])
const EMOJI = /\p{Extended_Pictographic}/gu
// Any statement that there was no time with people, however worded: "No time
// with people was logged", "no time with friends or family", "no social
// time", "no calls were logged", "Time with people: none".
const WITH_WHOM = 'people|others|friends|family|loved ones'
const ABSENCE = new RegExp(
  `\\bno (?:time |hours? )?(?:spent |logged )?(?:with (?:${WITH_WHOM})|social(?: time| activit(?:y|ies))?|calls?)\\b` +
    `|\\b(?:time with (?:${WITH_WHOM})(?: (?:or|and) (?:${WITH_WHOM}))?|social time)(?: was not\\b|: none\\b)`,
  'gi'
)
// The wordings that are no longer allowed even when it is true: the phrase
// is "friends or family", because meetings are people too.
const ABSENCE_OLD_WORDS =
  /\bno (?:time |hours? )?(?:spent |logged )?(?:with (?:people|others)|social(?: time| activit(?:y|ies))?|calls?)\b|\b(?:time with (?:people|others)|social time)(?: was not\b|: none\b)/gi
const FRIENDS_OR_FAMILY = /friends (?:or|and) family/i
// A label from the data, colon and all, pasted into the line.
const LABEL_READ_BACK = new RegExp(
  `\\b(?:${[...REVIEW_DATA_LABELS, ...Object.values(CATEGORY_LABELS), 'Time with people', 'Time with friends or family']
    .map(escape)
    .join('|')}):`,
  'gi'
)

// ── Grounding: every clock time and number in the line is in the facts ──

// Number words the line may use for a figure in the facts. "One" is left
// out: it is as often a pronoun ("one of the days") as a count.
const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, both: 2,
}
const CLOCK_12 = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/gi
const CLOCK_24 = /\b([01]?\d|2[0-4]):([0-5]\d)\b/g

/** The clock times in a text, as minutes from midnight; the text with them taken out. */
function clockTimes(text: string): { times: number[]; rest: string } {
  const times: number[] = []
  let rest = text.replace(CLOCK_12, (_m, h: string, m: string | undefined, ampm: string) => {
    const pm = ampm.toLowerCase().startsWith('p')
    const hour = (Number(h) % 12) + (pm ? 12 : 0)
    times.push(hour * 60 + Number(m ?? 0))
    return ' '
  })
  rest = rest.replace(CLOCK_24, (_m, h: string, m: string) => {
    times.push((Number(h) % 24) * 60 + Number(m))
    return ' '
  })
  return { times, rest }
}

function numbersIn(text: string): number[] {
  const digits = Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((m) => Number(m[0]))
  const words = Array.from(text.toLowerCase().matchAll(/\b[a-z]+\b/g))
    .map((m) => NUMBER_WORDS[m[0]])
    .filter((n): n is number => n !== undefined)
  return [...digits, ...words]
}

/** Times and numbers in the line that the facts do not contain. */
function ungrounded(text: string, facts: readonly string[]): string[] {
  const source = facts.join(' ')
  const factTimes = new Set(clockTimes(source).times)
  // Every number anywhere in the facts, the parts of their clock times included.
  const factNumbers = new Set(numbersIn(source))
  const { times, rest } = clockTimes(text)
  const missing: string[] = []
  for (const t of times) {
    if (!factTimes.has(t)) missing.push(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`)
  }
  for (const n of numbersIn(rest)) if (!factNumbers.has(n)) missing.push(String(n))
  return missing
}

export function checkReviewLine(
  text: string,
  opts: {
    kind: 'day' | 'week'
    mood?: 'low' | 'okay' | 'great' | null
    /** Minutes of Social, Calls and Faith in the input, when known. */
    peopleMinutes?: number
    /** A week still in progress: nothing is said about what it lacks. */
    isPartialWeek?: boolean
    /** The kind of read the line words, when it words one. */
    readKind?: ReadKind
    /** The read's facts: every time and number in the line must be among them. */
    facts?: readonly string[]
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

  // A line that says nobody was seen when somebody was is false; a day line
  // never says it at all; a finished week with none says it, as "friends or
  // family"; a week in progress does not.
  const absence = findAll(text, ABSENCE)
  const hasSome = (opts.peopleMinutes ?? 0) > 0
  if (hasSome) add('false-absence', absence)
  else if (opts.kind === 'day') add('day-absence', absence)
  if (opts.kind === 'week' && !hasSome) {
    add('absence-wording', findAll(text, ABSENCE_OLD_WORDS))
    if (opts.isPartialWeek === true) add('partial-week-absence', absence)
    else if (opts.peopleMinutes === 0 && !FRIENDS_OR_FAMILY.test(text)) {
      breaches.push({ rule: 'absence-unsaid', found: '' })
    }
  }
  add('label-read-back', findAll(text, LABEL_READ_BACK))

  if (opts.kind === 'day') {
    add('relative-day', findAll(text, RELATIVE_DAY))
    // A Keep may say the hour is there again and a Change gives an option:
    // what they must not do is correct. Anything else gives no advice.
    if (opts.readKind === 'keep' || opts.readKind === 'change') add('correction', findAll(text, CORRECTION))
    else add('advice', findAll(text, ADVICE))
    if (opts.mood !== 'low') add('hard-day', findAll(text, HARD_DAY))
  } else {
    add('correction', findAll(text, CORRECTION))
  }

  if (opts.readKind === 'nothing') add('nothing-advice', findAll(text, NOTHING_ADVICE))
  add('cause', findAll(text, CAUSE))
  if (opts.facts) add('ungrounded', ungrounded(text, opts.facts))

  const sentences = findAll(text, /[.!?](?=\s+\S|\s*$)/g).length
  const limit = opts.kind === 'day' ? 2 : 4
  if (sentences > limit) breaches.push({ rule: 'too-long', found: `${sentences} sentences` })

  for (const line of text.split('\n')) {
    if (/^\s*(?:-|•|\d+\.)/.test(line)) {
      breaches.push({ rule: 'list', found: line.trim() })
      break
    }
  }

  return breaches
}
