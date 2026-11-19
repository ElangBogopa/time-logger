/**
 * The rules a session comment or an entry remark can be checked against
 * without a model.
 *
 * Used by tests and by scripts/eval/coach-voice.eval.ts only. It is not run
 * in the routes: a check there would mean dropping or regenerating lines for
 * real people, which is a separate decision.
 */

import { COACH_BANNED_WORDS } from '@/lib/prompts'
import type { VoiceBreach } from '@/lib/review-voice-check'
import { CATEGORY_LABELS } from '@/lib/types'
import type { AheadKind, EntryFacts, RingFact, SessionFacts } from '@/lib/coach-facts'

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function wordRegex(words: readonly string[]): RegExp {
  return new RegExp(`(?<![\\w'])(?:${words.map(escape).join('|')})(?![\\w'])`, 'gi')
}

function findAll(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re)).map((m) => m[0])
}

const BANNED = wordRegex(COACH_BANNED_WORDS)
const SCOLD = wordRegex(['should have', 'should', 'need to', 'must', 'next time', 'try to'])
const SCORE_NUMBER = /\/100|\bout of 100\b|\b(?:body|mind|heart)\s+(?:at\s+|of\s+)?\d+/gi
const EMOJI = /\p{Extended_Pictographic}/gu
const LOOKS_AHEAD = wordRegex(['later today', 'tonight', 'tomorrow'])
// "There is still time left today" looks ahead without naming a time: a day
// that is over has none left, and the three words above did not catch it.
const TIME_LEFT =
  /\btime (?:left|remaining|remains)\b|\bstill (?:have |got )?(?:plenty of |some )?time\b|\b(?:rest|remainder) of (?:the|your) day\b|\bstill (?:ahead|possible)\b|\byet to come\b/gi
// After the evening the day's sessions are over, though tomorrow is ahead.
const TIME_LEFT_TODAY = /\blater today\b|\btime (?:left|remaining) (?:today|in the day|in your day)\b/gi

export function checkCoachLine(
  text: string,
  opts: { kind: 'session' | 'entry'; aheadKind?: AheadKind }
): VoiceBreach[] {
  const breaches: VoiceBreach[] = []
  const add = (rule: string, found: string[]) => {
    for (const f of found) breaches.push({ rule, found: f })
  }

  if (text.trim().length === 0) return [{ rule: 'empty', found: '' }]

  add('banned-word', findAll(text, BANNED))
  add('scold', findAll(text, SCOLD))
  add('score-number', findAll(text, SCORE_NUMBER))
  add('emoji', findAll(text, EMOJI))
  if (findAll(text, /!/g).length > 1) breaches.push({ rule: 'exclamation', found: '!' })

  const sentences = findAll(text, /[.!?]+(?=\s+\S|\s*$)/g).length
  const words = text.trim().split(/\s+/).length
  if (opts.kind === 'entry') {
    if (words > 20 || sentences > 1) breaches.push({ rule: 'too-long', found: `${words} words, ${sentences} sentences` })
  } else if (words > 70 || sentences > 3) {
    breaches.push({ rule: 'too-long', found: `${words} words, ${sentences} sentences` })
  }

  if (opts.kind === 'session' && opts.aheadKind === 'none') {
    add('looks-ahead', findAll(text, LOOKS_AHEAD))
    add('looks-ahead', findAll(text, TIME_LEFT))
  }
  if (opts.kind === 'session' && opts.aheadKind === 'tomorrow') add('looks-ahead', findAll(text, TIME_LEFT_TODAY))

  return breaches
}

// ─────────────────────────────────────────────────────────────────────────
// Is the line true to its facts? The part a machine can decide.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rules of `checkCoachGrounding`, plus `looks-ahead` from `checkCoachLine`:
 * a line that breaks any of them says something its facts do not.
 */
export const COACH_GROUNDING_RULES = ['invented-target', 'ring-state', 'no-plan', 'plan-not-ahead', 'looks-ahead'] as const

export type CoachGroundingInput =
  | { kind: 'session'; facts: SessionFacts }
  | { kind: 'entry'; facts: Pick<EntryFacts, 'activity' | 'rings'> }

// Only Body, Mind and Heart have targets. A kind of activity does not, so
// "your rest target" and "its target for admin time" are made up. "Other" is
// left out ("the other targets" is ordinary English) and so is "Exercise":
// Body's own line counts exercise minutes of a target.
const KIND_WORDS = [
  ...Object.entries(CATEGORY_LABELS)
    .filter(([key]) => key !== 'other' && key !== 'exercise')
    .map(([, label]) => label.toLowerCase()),
  'leisure', 'screen', 'tv', 'downtime', 'relaxation', 'nap', 'productivity',
]

const RING = '(?:body|mind|heart)'
const RING_LIST = `${RING}(?:(?:\\s*,\\s*(?:and\\s+|or\\s+)?|\\s+(?:and|or)\\s+)(?:the\\s+)?${RING})*`
const OPEN_TAIL = `(?:\\s+(?:is|are|remains?|stays?|was|were))?(?:\\s+(?:all three|all|both|each))?(?:\\s+still)?\\s+open\\b`
// "Body and Mind are still open", "The Body, Mind, and Heart rings are all still open".
const NAMED_OPEN = new RegExp(`\\b(${RING_LIST})(?:\\s+(?:rings?|targets?))?${OPEN_TAIL}`, 'gi')
// "the rings are all still open", "the targets are still open".
const ANY_OPEN = new RegExp(`\\b(?:rings?|targets?)${OPEN_TAIL}`, 'gi')

const AS_PLANNED = /\b(?:as|than) planned\b|\bon plan\b(?!\s+and\b)|\b(?:according|went|going) to plan\b|\b(?:stuck|kept|keeping|sticking) to (?:the|your) plan\b/gi
const NO_PLAN = /\bno plans?\b|\bnothing (?:was )?planned\b|\bwithout a plan\b|\bunplanned\b/gi
const STILL_POSSIBLE = /\b(?:still|can|could|chance|time to|time for|room to|room for|later|tonight|yet)\b/gi
const NEGATED = /\b(?:not|never|no longer)\b|n['’]t\b/i
const SMALL_WORDS = new Set(['the', 'and', 'for', 'with', 'your', 'from', 'into'])

/**
 * What a line says that its facts do not, for the claims that can be read
 * without a model. It works from the facts themselves, not from their text.
 *
 * - `invented-target`: a target for an activity or its kind, any target on an
 *   entry that feeds no ring, or a ring the entry's facts do not hold.
 * - `ring-state`: a ring called open that the facts do not mark "still open".
 * - `no-plan`: "as planned" with no plan in the facts, or a claim that there
 *   was no plan (the facts never say so).
 * - `plan-not-ahead`: a plan not done, pointed at as still possible when no
 *   "Still ahead" line names it.
 *
 * It finds the common shapes of these, not every wording: a line it passes is
 * not proven true, and the eval's judge reads what is left.
 */
export function checkCoachGrounding(text: string, input: CoachGroundingInput): VoiceBreach[] {
  const breaches: VoiceBreach[] = []
  const add = (rule: string, found: string[]) => {
    for (const f of found) breaches.push({ rule, found: f })
  }
  const rings: RingFact[] = input.facts.rings
  const ringNamed = (name: string) => rings.find((r) => r.label.toLowerCase() === name.toLowerCase())

  // invented-target
  const activities =
    input.kind === 'session' ? input.facts.activities.map((a) => a.activity) : [input.facts.activity]
  const kinds = [...KIND_WORDS, ...activities.map((a) => a.toLowerCase())].map(escape).join('|')
  add(
    'invented-target',
    findAll(
      text,
      new RegExp(
        `(?<![\\w'])(?:${kinds})(?:\\s+(?:time|minutes|hours))?\\s+(?:targets?|goals?)\\b|\\b(?:targets?|goals?)\\s+(?:for|of|on)\\s+(?:(?:your|the|today['’]s)\\s+)?(?:${kinds})(?![\\w'])`,
        'gi'
      )
    )
  )
  if (input.kind === 'entry') {
    if (rings.length === 0) {
      add('invented-target', findAll(text, /\b(?:targets?|goals?|rings?)\b|\b(?:Body|Mind|Heart)\b/g))
    } else {
      add('invented-target', findAll(text, /\b(?:Body|Mind|Heart)\b/g).filter((name) => !ringNamed(name)))
    }
  }

  // ring-state
  let unnamed = text
  for (const m of text.matchAll(NAMED_OPEN)) {
    const names = findAll(m[1], new RegExp(RING, 'gi'))
    if (names.some((name) => ringNamed(name)?.state !== 'open')) breaches.push({ rule: 'ring-state', found: m[0] })
    unnamed = unnamed.replace(m[0], ' ')
  }
  if (!rings.some((r) => r.state === 'open')) add('ring-state', findAll(unnamed, ANY_OPEN))

  if (input.kind === 'session') {
    const { plansKept, plansNotDone, ahead } = input.facts

    // no-plan
    if (plansKept.length === 0 && ahead.plans.length === 0) add('no-plan', findAll(text, AS_PLANNED))
    add('no-plan', findAll(text, NO_PLAN))

    // plan-not-ahead
    const aheadTitles = new Set(ahead.plans.map((p) => p.title.toLowerCase()))
    for (const plan of plansNotDone) {
      if (aheadTitles.has(plan.title.toLowerCase())) continue
      const words = plan.title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !SMALL_WORDS.has(w))
      if (words.length === 0) continue
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        for (const marker of sentence.matchAll(STILL_POSSIBLE)) {
          const clause = sentence.slice(marker.index, marker.index + 90).split(/[;:]|\bbut\b/i)[0]
          const ends = words.map((w) => {
            const hit = new RegExp(`\\b${escape(w)}\\p{L}*`, 'iu').exec(clause)
            return hit ? hit.index + hit[0].length : -1
          })
          if (ends.includes(-1)) continue
          const found = clause.slice(0, Math.max(...ends))
          if (NEGATED.test(found)) continue
          breaches.push({ rule: 'plan-not-ahead', found })
          break
        }
      }
    }
  }

  return breaches
}
