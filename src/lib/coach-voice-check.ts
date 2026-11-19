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
import type { AheadKind } from '@/lib/coach-facts'

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

  if (opts.kind === 'session' && opts.aheadKind === 'none') add('looks-ahead', findAll(text, LOOKS_AHEAD))

  return breaches
}
