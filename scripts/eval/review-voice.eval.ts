/**
 * @jest-environment node
 *
 * Voice evaluation for the line each review leads with.
 *
 * The scenarios are reads made by `dayRead` / `weekRead` from invented logs,
 * so the eval measures exactly what production sends: the read prompt
 * (`buildReadSystemPrompt`) and its facts (`describeRead`). Each line is
 * checked against the rules a machine can check (checkReviewLine, given the
 * read's kind and facts) and a second model grades the rest. Every line is
 * printed, because the point is that they get read.
 *
 *   EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice
 *
 * It fails when any line breaches ungrounded, nothing-advice, cause, empty
 * or absence-unsaid, or when more than 5% of lines breach any other checker
 * rule. Tune the prompt, not these thresholds.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import {
  buildReadSystemPrompt,
  describeRead,
  DAY_REVIEW_PARAMS,
  WEEK_REVIEW_PARAMS,
} from '../../src/lib/prompts'
import { dayRead, weekRead, type ReviewRead, type Row } from '../../src/lib/review-read'
import { heartMinutes } from '../../src/lib/metrics-calc'
import { windowsForWake } from '../../src/lib/ideal-day'
import { shiftDateString } from '../../src/lib/types'
import { minutesToTime, timeToMinutes } from '../../src/lib/time-utils'
import { checkReviewLine, type VoiceBreach } from '../../src/lib/review-voice-check'

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 6)
const SAMPLES = Number(process.env.EVAL_SAMPLES || 3)

function loadEnv() {
  for (const line of readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

// ─── Invented logs ────────────────

const windows = windowsForWake(null)
const D = '2026-11-16' // a Monday: the reviewed day
const MON = '2026-11-09' // a finished week
const back = (n: number) => shiftDateString(D, -n)
const weekDay = (i: number) => shiftDateString(MON, i)
const beforeWeek = (n: number) => shiftDateString(MON, -n)

function r(date: string, activity: string, category: string, start: string, minutes: number): Row {
  return {
    date,
    activity,
    category,
    start_time: start,
    end_time: minutesToTime(Math.min(24 * 60, timeToMinutes(start) + minutes)),
    duration_minutes: minutes,
  }
}
const days = (from: (n: number) => string, list: number[], make: (date: string) => Row[]) =>
  list.flatMap((n) => make(from(n)))

interface Scenario {
  id: string
  read: ReviewRead
  /** What Heart counted, for the checker's absence rules. */
  peopleMinutes: number
  isPartialWeek?: boolean
}

function day(id: string, expected: string, rows: Row[], history: Row[]): Scenario {
  const read = dayRead({ date: D, rows, history, windows })
  if (read.rule !== expected) throw new Error(`${id}: expected ${expected}, made ${read.rule}`)
  return { id, read, peopleMinutes: heartMinutes(rows) }
}

function week(
  id: string,
  expected: string,
  byDay: Record<number, Row[]>,
  history: Row[],
  opts: { isPartialWeek?: boolean; length?: number } = {}
): Scenario {
  const weekDays = Array.from({ length: opts.length ?? 7 }, (_, i) => ({ date: weekDay(i), rows: byDay[i] ?? [] }))
  const weekHeartMinutes = heartMinutes(weekDays.flatMap((d) => d.rows))
  const read = weekRead({ days: weekDays, history, windows, isPartialWeek: !!opts.isPartialWeek, weekHeartMinutes })
  if (read.rule !== expected) throw new Error(`${id}: expected ${expected}, made ${read.rule}`)
  return { id, read, peopleMinutes: weekHeartMinutes, isPartialWeek: opts.isPartialWeek }
}

const desk = (date: string) => [r(date, 'Client report', 'deep_work', '09:00', 120), r(date, 'Lunch', 'meals', '12:30', 30)]
const runs = (from: (n: number) => string, list: number[]) => days(from, list, (d) => [r(d, 'Run', 'exercise', '18:00', 30)])
const steadyHistory = days(back, [1, 2, 4, 5, 6, 8, 9, 11, 12], (d) => [
  r(d, 'Desk work', 'deep_work', '09:00', 60),
  r(d, 'Email', 'shallow_work', '13:00', 45),
  r(d, 'Call with mum', 'calls', '20:00', 20),
])

const DAY_SCENARIOS: Scenario[] = [
  day('no-movement-three-days', 'change-no-movement', desk(D), [...runs(back, [20, 18, 16, 14, 12]), ...days(back, [1, 2], desk)]),
  day(
    'focus-in-the-evenings',
    'change-focus-outside-window',
    [r(D, 'Essay draft', 'deep_work', '19:00', 120)],
    days(back, [1, 2], (d) => [r(d, 'Essay draft', 'deep_work', '19:30', 105)])
  ),
  day('long-focus-block', 'keep-long-focus', [r(D, 'Thesis chapter', 'deep_work', '09:15', 150), r(D, 'Lunch', 'meals', '12:30', 30)], steadyHistory),
  day('movement-target-reached', 'keep-movement-target', [r(D, 'Run', 'exercise', '17:30', 35), ...desk(D)], steadyHistory),
  day('evening-with-family', 'keep-people-time', [r(D, 'Dinner with family', 'social', '19:00', 150), ...desk(D)], steadyHistory),
  day('ordinary-day', 'nothing-ordinary', [r(D, 'Desk work', 'deep_work', '09:00', 60), r(D, 'Email', 'shallow_work', '13:00', 45)], steadyHistory),
  day('ordinary-day-thin-history', 'nothing-ordinary', [r(D, 'Email', 'shallow_work', '10:00', 90), r(D, 'Groceries', 'errands', '17:00', 40)], []),
]

const weekHistory = days(beforeWeek, [2, 3, 5, 6, 8, 9, 10, 12, 13, 15], (d) => [
  r(d, 'Desk work', 'deep_work', '09:00', 90),
  r(d, 'Call with mum', 'calls', '20:00', 20),
])

const WEEK_SCENARIOS: Scenario[] = [
  week(
    'movement-on-one-day',
    'week-change-movement-few-days',
    {
      0: desk(weekDay(0)),
      1: desk(weekDay(1)),
      2: [...desk(weekDay(2)), r(weekDay(2), 'Walk', 'movement', '12:00', 20)],
      3: desk(weekDay(3)),
      4: desk(weekDay(4)),
      5: [r(weekDay(5), 'Lunch with friends', 'social', '13:00', 90)],
    },
    [...weekHistory, ...runs(beforeWeek, [20, 18, 16, 14, 4])]
  ),
  week(
    'focus-outside-on-three-days',
    'week-change-focus-outside-window',
    {
      0: [r(weekDay(0), 'Essay draft', 'deep_work', '18:00', 120)],
      2: [r(weekDay(2), 'Essay draft', 'deep_work', '19:00', 150)],
      3: [r(weekDay(3), 'Essay draft', 'deep_work', '20:00', 90), r(weekDay(3), 'Call with dad', 'calls', '17:00', 30)],
      4: desk(weekDay(4)),
    },
    weekHistory
  ),
  week(
    'mind-on-target-early-starts',
    'week-keep-focus-start',
    {
      0: [r(weekDay(0), 'Email', 'shallow_work', '10:00', 60)],
      1: [r(weekDay(1), 'Thesis chapter', 'deep_work', '09:00', 240), r(weekDay(1), 'Dinner with friends', 'social', '19:00', 90)],
      3: [r(weekDay(3), 'Thesis chapter', 'deep_work', '09:30', 250)],
      4: desk(weekDay(4)),
    },
    weekHistory
  ),
  week(
    'movement-target-four-days',
    'week-keep-movement-days',
    {
      0: [r(weekDay(0), 'Run', 'exercise', '18:00', 30), ...desk(weekDay(0))],
      2: [r(weekDay(2), 'Run', 'exercise', '18:15', 35), ...desk(weekDay(2))],
      4: [r(weekDay(4), 'Run', 'exercise', '17:45', 30)],
      5: [r(weekDay(5), 'Long run', 'exercise', '09:00', 60), r(weekDay(5), 'Brunch with friends', 'social', '11:00', 90)],
    },
    weekHistory
  ),
  week(
    'ordinary-week',
    'week-nothing-ordinary',
    { 0: desk(weekDay(0)), 1: [r(weekDay(1), 'Call with mum', 'calls', '20:00', 60)], 2: desk(weekDay(2)), 3: desk(weekDay(3)) },
    weekHistory
  ),
  // A finished week with no time with friends or family: the read must carry the sentence.
  week(
    'keep-week-no-friends-or-family',
    'week-keep-movement-days',
    {
      0: [r(weekDay(0), 'Run', 'exercise', '18:00', 30), ...desk(weekDay(0))],
      2: [r(weekDay(2), 'Run', 'exercise', '18:00', 30), ...desk(weekDay(2))],
      4: [r(weekDay(4), 'Run', 'exercise', '18:30', 30), ...desk(weekDay(4))],
    },
    weekHistory
  ),
  week(
    'nothing-week-no-friends-or-family',
    'week-nothing-ordinary',
    { 0: desk(weekDay(0)), 2: desk(weekDay(2)), 3: [r(weekDay(3), 'Email', 'shallow_work', '10:00', 120)] },
    weekHistory
  ),
  week(
    'week-in-progress',
    'week-nothing-ordinary',
    { 0: desk(weekDay(0)), 1: [r(weekDay(1), 'Email', 'shallow_work', '10:00', 120)], 2: desk(weekDay(2)) },
    weekHistory,
    { isPartialWeek: true, length: 3 }
  ),
]

// ─── The judge ────────────────

const JUDGE_ALL = [
  ['grounded', 'Every number, hour, day and activity in the line appears in the facts. Nothing is invented: no extra fact, reason or cause.'],
  ['no_evaluation', 'The line does not say or imply the day, the week or the person was good, bad, strong, weak, enough or not enough.'],
  ['no_consolation', 'No reassurance, sympathy or encouragement.'],
] as const
const JUDGE_NOTHING = [['no_advice', 'Nothing is suggested or recommended.']] as const
const judgeRules = (read: ReviewRead) => [...JUDGE_ALL, ...(read.kind === 'nothing' ? JUDGE_NOTHING : [])]

interface Line {
  scenario: Scenario
  sample: number
  line: string
  breaches: VoiceBreach[]
  judge: Record<string, boolean>
  note: string
}

const out = (s = '') => process.stdout.write(s + '\n')

async function judgeLine(openai: OpenAI, read: ReviewRead, line: string) {
  const rules = judgeRules(read)
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are grading one ${read.scope} review line written from a list of facts. Answer strictly as JSON.

THE FACTS THE WRITER HAD:
${read.facts.join('\n')}

Grade each rule true (kept) or false (broken):
${rules.map(([k, d]) => `- ${k}: ${d}`).join('\n')}

Respond with JSON only: {${rules.map(([k]) => `"${k}": bool`).join(', ')}, "note": "one short sentence on the worst problem, or 'fine'"}`,
      },
      { role: 'user', content: line },
    ],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  })
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}')
  } catch {
    parsed = {}
  }
  const judge: Record<string, boolean> = {}
  for (const [k] of rules) judge[k] = parsed[k] === true
  return { judge, note: String(parsed.note ?? '') }
}

async function run(): Promise<Line[]> {
  loadEnv()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const all = [...DAY_SCENARIOS, ...WEEK_SCENARIOS]
  const jobs = all.flatMap((scenario) => Array.from({ length: SAMPLES }, (_, sample) => ({ scenario, sample })))
  const results: Line[] = new Array(jobs.length)

  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= jobs.length) return
      const { scenario, sample } = jobs[i]
      const { read } = scenario
      const params = read.scope === 'day' ? DAY_REVIEW_PARAMS : WEEK_REVIEW_PARAMS
      const line =
        (
          await openai.chat.completions.create({
            ...params,
            messages: [
              { role: 'system', content: buildReadSystemPrompt(read.scope, read.kind) },
              { role: 'user', content: describeRead(read) },
            ],
          })
        ).choices[0]?.message?.content?.trim() || ''

      const breaches = checkReviewLine(line, {
        kind: read.scope,
        peopleMinutes: scenario.peopleMinutes,
        isPartialWeek: read.scope === 'week' ? !!scenario.isPartialWeek : undefined,
        readKind: read.kind,
        facts: read.facts,
      })
      const { judge, note } = await judgeLine(openai, read, line)
      results[i] = { scenario, sample, line, breaches, judge, note }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

/** Any one line breaching these fails the run. */
const HARD_RULES = ['ungrounded', 'nothing-advice', 'cause', 'empty', 'absence-unsaid']
/** The share of lines that may breach any other checker rule. */
const SOFT_LIMIT = 0.05

const CHECKER_RULES = [
  ...HARD_RULES,
  'banned-word', 'verdict', 'exclamation', 'question', 'emoji', 'score-talk',
  'relative-day', 'advice', 'correction', 'hard-day', 'false-absence', 'day-absence', 'absence-wording',
  'partial-week-absence', 'label-read-back', 'too-long', 'list',
]
const JUDGE_RULES = [...JUDGE_ALL, ...JUDGE_NOTHING].map(([k]) => k as string)

function report(results: Line[]) {
  const checkerCounts: Record<string, number> = {}
  for (const r of CHECKER_RULES) checkerCounts[r] = results.filter((x) => x.breaches.some((b) => b.rule === r)).length
  const judgeCounts: Record<string, number> = {}
  for (const r of JUDGE_RULES) judgeCounts[r] = results.filter((x) => r in x.judge && !x.judge[r]).length
  const hardLines = results.filter((x) => x.breaches.some((b) => HARD_RULES.includes(b.rule))).length
  const softLines = results.filter((x) => x.breaches.some((b) => !HARD_RULES.includes(b.rule))).length

  const L: string[] = []
  L.push('# Review voice lines')
  L.push('')
  L.push(
    `Date: ${new Date().toISOString().slice(0, 10)}. ${results.length} lines, ${SAMPLES} per scenario. Each scenario is a read made by \`dayRead\` / \`weekRead\` from an invented log; the model was given \`buildReadSystemPrompt\` and \`describeRead\`.`
  )
  L.push('')
  L.push(`Day params: \`${JSON.stringify(DAY_REVIEW_PARAMS)}\``)
  L.push(`Week params: \`${JSON.stringify(WEEK_REVIEW_PARAMS)}\``)
  L.push('')
  L.push('| rule | kind | lines breaching |')
  L.push('|---|---|---|')
  for (const r of CHECKER_RULES) L.push(`| ${r} | checker${HARD_RULES.includes(r) ? ' (any line fails)' : ''} | ${checkerCounts[r]} |`)
  for (const r of JUDGE_RULES) L.push(`| ${r} | judge | ${judgeCounts[r]} |`)
  L.push('')
  L.push(
    `Lines breaching a rule that fails the run: ${hardLines}. Lines breaching any other checker rule: ${softLines} of ${results.length} (limit ${Math.floor(results.length * SOFT_LIMIT)}). Lines failing any judge rule: ${results.filter((x) => Object.values(x.judge).some((v) => !v)).length}.`
  )
  L.push('')
  for (const s of Array.from(new Set(results.map((x) => x.scenario)))) {
    L.push(`## ${s.read.scope}: ${s.id} (${s.read.rule})`)
    L.push('')
    for (const fact of s.read.facts) L.push(`- fact: ${fact}`)
    L.push('')
    for (const r of results.filter((x) => x.scenario === s)) {
      L.push(`> ${r.line.replace(/\n/g, '\n> ')}`)
      L.push('')
      const failed = Object.entries(r.judge).filter(([, v]) => !v).map(([k]) => k)
      if (r.breaches.length) L.push(`- checker: ${r.breaches.map((b) => `${b.rule} ("${b.found}")`).join(', ')}`)
      if (failed.length) L.push(`- judge: ${failed.join(', ')}`)
      L.push(`- note: ${r.note}`)
      L.push('')
    }
  }
  return { text: L.join('\n'), hardLines, softLines }
}

it('reads the review lines against the voice and the facts', async () => {
  const results = await run()
  const { text, hardLines, softLines } = report(results)
  out(text)
  if (process.env.EVAL_REPORT) writeFileSync(path.join(process.cwd(), process.env.EVAL_REPORT), text + '\n')
  expect(hardLines).toBe(0)
  expect(softLines).toBeLessThanOrEqual(Math.floor(results.length * SOFT_LIMIT))
}, 1_800_000)
