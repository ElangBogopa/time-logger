/**
 * @jest-environment node
 *
 * Reply-quality evaluation for /api/commentary/thread.
 *
 * Tone cannot be asserted with string matching, so each reply is scored by a
 * second model against the rules the prompt sets, one boolean per rule. That
 * judge is itself fallible, which is why every failure is printed verbatim —
 * the numbers point at where to look, the transcripts are the evidence.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { TimeEntry } from '../../src/lib/types'
import { buildThreadSystemPrompt, describeEntries } from '../../src/lib/prompts'

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 6)

function loadEnv() {
  for (const line of readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

function entry(activity: string, category: string, minutes: number, start: string): TimeEntry {
  return {
    id: `e-${start}`,
    user_id: 'eval',
    date: '2026-11-02',
    activity,
    category,
    duration_minutes: minutes,
    start_time: start,
    end_time: start,
    status: 'confirmed',
  } as unknown as TimeEntry
}

const DAYS = {
  workday: [
    entry('Gym: Leg Day', 'exercise', 60, '06:30'),
    entry('Work', 'deep_work', 180, '09:00'),
    entry('Lunch', 'meals', 60, '12:00'),
    entry('Work', 'shallow_work', 120, '13:00'),
  ],
  religious: [
    entry('Fajr prayer', 'other', 30, '05:30'),
    entry('Quran study circle', 'learning', 90, '19:00'),
    entry('Work', 'deep_work', 300, '09:00'),
  ],
  leisure: [
    entry('Netflix', 'entertainment', 180, '19:00'),
    entry('Scrolling TikTok', 'entertainment', 90, '22:00'),
    entry('Lunch', 'meals', 45, '12:30'),
  ],
  thin: [entry('Work', 'shallow_work', 480, '09:00')],
}

interface Scenario {
  id: string
  day: keyof typeof DAYS
  commentary: string
  question: string
  /** Prior turns, for testing how it handles being challenged. */
  history?: { role: 'user' | 'assistant'; content: string }[]
  kind: 'factual' | 'pushback' | 'religious' | 'contested' | 'advice_sought' | 'out_of_scope'
}

const COMMENTARY = {
  workday: 'Five hours of work and a leg day before most people are up. Solid.',
  religious: 'Five hours of focus plus study in the evening — a full day.',
  leisure: 'Four and a half hours of screens tonight. The day got away from you.',
  thin: 'Eight hours logged as work. Hard to say much more than that.',
}

const SCENARIOS: Scenario[] = [
  { id: 'why-not-deep', day: 'workday', commentary: COMMENTARY.workday, question: "How come the afternoon work didn't count as deep work?", kind: 'factual' },
  { id: 'what-counted', day: 'workday', commentary: COMMENTARY.workday, question: 'What counted towards focus today?', kind: 'factual' },
  { id: 'how-many-hours', day: 'workday', commentary: COMMENTARY.workday, question: 'How many hours did I actually work?', kind: 'factual' },
  { id: 'tone-complaint', day: 'workday', commentary: COMMENTARY.workday, question: 'I dont like your tone', history: [{ role: 'user', content: 'why was that shallow work?' }, { role: 'assistant', content: 'The afternoon block was categorised as shallow work, which usually means lighter tasks.' }], kind: 'pushback' },
  { id: 'insulted', day: 'thin', commentary: COMMENTARY.thin, question: 'That feels insulting, I was working my 9-5 as an actuary all day.', kind: 'pushback' },
  { id: 'disputes-fact', day: 'workday', commentary: COMMENTARY.workday, question: 'You said I did no deep work, but I coded all morning.', kind: 'pushback' },
  { id: 'accuses-of-guessing', day: 'thin', commentary: COMMENTARY.thin, question: 'You are just guessing about me, arent you?', kind: 'pushback' },
  { id: 'prayer-counted', day: 'religious', commentary: COMMENTARY.religious, question: 'Why is my morning prayer categorised as other?', kind: 'religious' },
  { id: 'prayer-productive', day: 'religious', commentary: COMMENTARY.religious, question: 'Prayer is the most important part of my day. Does it count for anything here?', kind: 'religious' },
  { id: 'quran-learning', day: 'religious', commentary: COMMENTARY.religious, question: 'Is Quran study the same as studying for an exam as far as you are concerned?', kind: 'religious' },
  { id: 'faith-judgement', day: 'religious', commentary: COMMENTARY.religious, question: 'Do you think spending 2 hours on faith is a waste of a weekday?', kind: 'religious' },
  { id: 'gaming-career', day: 'leisure', commentary: COMMENTARY.leisure, question: 'The gaming is esports practice, I compete. Is that still entertainment?', kind: 'contested' },
  { id: 'defends-leisure', day: 'leisure', commentary: COMMENTARY.leisure, question: 'I had a hard week. Is it really a problem that I watched TV?', kind: 'contested' },
  { id: 'asks-advice', day: 'leisure', commentary: COMMENTARY.leisure, question: 'What should I do differently tomorrow?', kind: 'advice_sought' },
  { id: 'asks-how-to-log', day: 'thin', commentary: COMMENTARY.thin, question: 'How should I log my work so it reads better?', kind: 'advice_sought' },
  { id: 'unanswerable', day: 'workday', commentary: COMMENTARY.workday, question: 'Was I more productive than last Tuesday?', kind: 'out_of_scope' },
  { id: 'personal', day: 'workday', commentary: COMMENTARY.workday, question: 'Do you think I am doing well in life?', kind: 'out_of_scope' },
  { id: 'invented-number', day: 'thin', commentary: COMMENTARY.thin, question: 'How much deep work did I do this week?', kind: 'out_of_scope' },
]

const RULES = [
  ['answers_question', 'The reply answers the question that was asked.'],
  ['no_unsolicited_advice', 'The reply does NOT end with advice, a suggestion or a "next time try…" unless the question explicitly asked what to do.'],
  ['no_blame', 'The reply does NOT suggest or imply the person was lazy, distracted, slacking, multitasking or not really working.'],
  ['grounded', 'Every activity, category, number and time mentioned appears in the DATA. Nothing is invented, and if the data cannot answer the question the reply says so.'],
  ['no_defending', 'If the person challenges the tone or the facts, the reply re-examines rather than justifying itself. (Mark true if the person did not challenge anything.)'],
  ['has_voice', 'The reply sounds like a person with some warmth or dryness, not a support ticket. Phrases like "I understand how that feels, but" or "it doesn\'t take away from" count as failures.'],
  ['respectful_of_values', 'The reply does not judge the worth of how the person chose to spend their time, especially religious practice. (Mark true if not applicable.)'],
] as const

interface Scored {
  scenario: Scenario
  reply: string
  verdicts: Record<string, boolean>
  judgeNote: string
}

const out = (line = '') => process.stdout.write(line + '\n')

async function run(): Promise<Scored[]> {
  loadEnv()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const results: Scored[] = new Array(SCENARIOS.length)

  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= SCENARIOS.length) return
      const s = SCENARIOS[i]
      const entries = DAYS[s.day]
      const subjectContext = `2026-11-02: ${entries.length} activities, ${entries.reduce((a, e) => a + e.duration_minutes, 0)} minutes logged.\n${describeEntries(entries)}`

      const reply =
        (
          await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: buildThreadSystemPrompt({ subjectContext, subjectCommentary: s.commentary }) },
              ...(s.history || []),
              { role: 'user', content: s.question },
            ],
            temperature: 0.7,
            max_tokens: 200,
          })
        ).choices[0]?.message?.content?.trim() || ''

      const judge = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are grading one reply from a time-tracking assistant. Answer strictly as JSON.

DATA THE ASSISTANT WAS GIVEN:
${subjectContext}

WHAT IT HAD PREVIOUSLY SAID: ${s.commentary}

THE PERSON ASKED: ${s.question}

Grade each rule true or false:
${RULES.map(([k, d]) => `- ${k}: ${d}`).join('\n')}

Respond with JSON only: {${RULES.map(([k]) => `"${k}": bool`).join(', ')}, "note": "one short sentence on the worst problem, or 'fine'"}`,
          },
          { role: 'user', content: reply },
        ],
        temperature: 0,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      })

      let parsed: Record<string, unknown> = {}
      try {
        parsed = JSON.parse(judge.choices[0]?.message?.content || '{}')
      } catch {
        parsed = {}
      }
      const verdicts: Record<string, boolean> = {}
      for (const [k] of RULES) verdicts[k] = parsed[k] === true
      results[i] = { scenario: s, reply, verdicts, judgeNote: String(parsed.note ?? '') }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

it('judges the thread replies', async () => {
  const results = await run()

  out(`\n${'='.repeat(64)}`)
  out(`REPLY QUALITY — ${results.length} scenarios`)
  out('='.repeat(64))

  out('\nBy rule:')
  for (const [key, desc] of RULES) {
    const pass = results.filter((r) => r.verdicts[key]).length
    const bar = '█'.repeat(Math.round((pass / results.length) * 20)).padEnd(20, '·')
    out(`  ${key.padEnd(22)} ${bar} ${pass}/${results.length}`)
    if (pass < results.length) out(`  ${' '.repeat(22)} ${desc}`)
  }

  out('\nBy question type:')
  const kinds = Array.from(new Set(results.map((r) => r.scenario.kind)))
  for (const k of kinds) {
    const rows = results.filter((r) => r.scenario.kind === k)
    const broken = rows.reduce((n, r) => n + RULES.filter(([key]) => !r.verdicts[key]).length, 0)
    out(`  ${k.padEnd(16)} ${rows.length} scenarios, ${broken} rule breaches`)
  }

  out('\nEvery reply that broke a rule:')
  for (const r of results) {
    const failed = RULES.filter(([k]) => !r.verdicts[k]).map(([k]) => k)
    if (!failed.length) continue
    out(`\n  [${r.scenario.id}] ${r.scenario.question}`)
    out(`    → ${r.reply}`)
    out(`    ✗ ${failed.join(', ')} — ${r.judgeNote}`)
  }

  out('\nA clean one, for comparison:')
  const clean = results.find((r) => RULES.every(([k]) => r.verdicts[k]))
  if (clean) {
    out(`  [${clean.scenario.id}] ${clean.scenario.question}`)
    out(`    → ${clean.reply}`)
  } else {
    out('  (none passed every rule)')
  }

  expect(results.every((r) => r.reply.length > 0)).toBe(true)
}, 1_800_000)
