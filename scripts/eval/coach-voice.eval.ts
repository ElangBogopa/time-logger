/**
 * @jest-environment node
 *
 * Voice evaluation for the session comment and the per-entry remark.
 *
 * Asks the real model for lines across invented sessions and entries, using
 * the prompts and params production sends (src/lib/prompts.ts), checks each
 * line against the rules a machine can check (checkCoachLine) and has a
 * second model grade the rest. Every line is printed because the point is
 * that they get read.
 *
 *   EVAL_SAMPLES=3 npm run eval:coach        (writes docs/voice-lines/coach.md)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import {
  buildSessionFacts,
  buildEntryFacts,
  type CoachEntry,
  type AheadKind,
} from '../../src/lib/coach-facts'
import {
  SESSION_COMMENT_PARAMS,
  ENTRY_REMARK_PARAMS,
  buildSessionCommentarySystemPrompt,
  buildEntryRemarkSystemPrompt,
  describeSessionFacts,
  describeEntryFacts,
} from '../../src/lib/prompts'
import { checkCoachLine } from '../../src/lib/coach-voice-check'
import type { VoiceBreach } from '../../src/lib/review-voice-check'
import { windowsForWake } from '../../src/lib/ideal-day'
import type { PlanRow } from '../../src/lib/plan-adherence'
import type { TimePeriod, TimeCategory } from '../../src/lib/types'

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 6)
const SAMPLES = Number(process.env.EVAL_SAMPLES || 3)
const REPORT = process.env.EVAL_REPORT || 'docs/voice-lines/coach.md'

function loadEnv() {
  for (const line of readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

let n = 0
function e(
  activity: string,
  category: TimeCategory,
  start: string,
  end: string,
  minutes: number,
  description: string | null = null
): CoachEntry {
  n += 1
  return { id: `e${n}`, activity, category, duration_minutes: minutes, start_time: start, end_time: end, description }
}

function plan(title: string, start: string, end: string, completed = false): PlanRow {
  n += 1
  return { id: `p${n}`, title, completed, committed_start: start, committed_end: end }
}

const WINDOWS = windowsForWake(null)
const at = (h: number, m = 0) => h * 60 + m

interface SessionScenario {
  kind: 'session'
  id: string
  aheadKind: AheadKind
  system: string
  input: string
}
interface EntryScenario {
  kind: 'entry'
  id: string
  system: string
  input: string
}
type Scenario = SessionScenario | EntryScenario

function session(
  id: string,
  period: TimePeriod,
  sessionEntries: CoachEntry[],
  opts: { before?: CoachEntry[]; plans?: PlanRow[]; nowMinutes: number | null }
): SessionScenario {
  const facts = buildSessionFacts({
    period,
    sessionEntries,
    dayEntries: [...(opts.before ?? []), ...sessionEntries],
    plans: opts.plans ?? [],
    windows: WINDOWS,
    nowMinutes: opts.nowMinutes,
  })
  return {
    kind: 'session',
    id,
    aheadKind: facts.ahead.kind,
    system: buildSessionCommentarySystemPrompt(facts.ahead.kind),
    input: describeSessionFacts(facts),
  }
}

function entry(id: string, target: CoachEntry, day: CoachEntry[]): EntryScenario {
  const facts = buildEntryFacts({ entry: target, dayEntries: day })
  return { kind: 'entry', id, system: buildEntryRemarkSystemPrompt(facts), input: describeEntryFacts(facts) }
}

const morningDeep = e('Essay draft', 'deep_work', '09:00', '13:00', 240)
const nap = e('Nap', 'rest', '14:00', '14:45', 45)
const tv = e('Watching TV', 'entertainment', '15:00', '16:30', 90)
const dinner = e('Dinner with family', 'social', '18:30', '20:00', 90)
const gym = e('Gym', 'exercise', '07:00', '07:45', 45)
const sleep = e('Sleep', 'sleep', '23:00', '07:00', 480)
const meals = [e('Breakfast', 'meals', '07:50', '08:15', 25), e('Lunch', 'meals', '12:30', '13:00', 30)]

const SCENARIOS: Scenario[] = [
  session('morning-mind-reaches-target', 'morning', [morningDeep], { nowMinutes: at(13), plans: [plan('Read', '21:00', '21:30')] }),
  session('quiet-afternoon-plan-upcoming', 'afternoon', [nap, tv], { nowMinutes: at(17), plans: [plan('Evening run', '19:00', '19:45')] }),
  session('afternoon-plan-not-done', 'afternoon', [e('Emails', 'admin', '13:00', '13:45', 45)], {
    nowMinutes: at(18),
    plans: [plan('Call Mum', '15:00', '15:30')],
  }),
  session('evening-heart-reaches-target', 'evening', [dinner], { nowMinutes: at(21), before: [e('Work', 'shallow_work', '10:00', '12:00', 120)] }),
  session('thin-evening', 'evening', [e('Tidying', 'chores', '19:00', '19:20', 20)], { nowMinutes: at(21) }),
  session('earlier-day', 'afternoon', [e('Study', 'learning', '13:00', '15:00', 120), tv], { nowMinutes: null }),
  entry('entry-tv', tv, [tv]),
  entry('entry-gym-takes-body-to-target', gym, [sleep, ...meals, gym]),
  entry('entry-nap', nap, [nap]),
  (() => {
    const sync = e('Project sync', 'meetings', '15:00', '16:00', 60)
    return entry('entry-third-hour-meetings', sync, [
      e('Standup', 'meetings', '09:30', '10:30', 60),
      e('Client call', 'meetings', '11:00', '12:00', 60),
      sync,
    ])
  })(),
]

const JUDGE = [
  [
    'grounded',
    'Every claim, number and activity in the line is in the facts. Nothing is invented. In particular: a target, ring, score or "on track" status may be mentioned only if a line of the facts states it for that very thing (a ring line names Body, Mind or Heart); a category such as rest, entertainment or admin has no target of its own, so "your rest target" or "target for admin time" is invented; a ring said to be open must be "still open" in the facts, and one that "did not reach its target" must not be called open; "as planned" or any plan must have a "Plan kept" or "Plan not done" line. Read the line against each of these before answering true.',
  ],
  ['on-side', 'No jab, tease, sarcasm, or invented flaw or motive. Reads as someone on the person\'s side.'],
  ['no-scold', 'Nothing is a correction, instruction or guilt.'],
] as const
const JUDGE_SESSION = [
  ['forward', 'The line ends by looking ahead to something still possible (later today or tomorrow). Answer true if no looking ahead was asked for (the input has no "Still ahead" line).'],
  ['not-premature', 'Nothing is judged as missed or failed that still has time left today (a ring marked "still open").'],
] as const

interface Line {
  scenario: Scenario
  sample: number
  line: string
  breaches: VoiceBreach[]
  judge: Record<string, boolean>
  note: string
}

async function judgeLine(openai: OpenAI, s: Scenario, line: string) {
  const rules = [...JUDGE, ...(s.kind === 'session' ? JUDGE_SESSION : [])]
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are grading one ${s.kind === 'session' ? 'session comment' : 'entry remark'} written by a coach from a time log. Answer strictly as JSON.

THE EXACT FACTS THE WRITER HAD:
${s.input}

Grade each rule true (kept) or false (broken):
${rules.map(([k, d]) => `- ${k}: ${d}`).join('\n')}

Respond with JSON only: {${rules.map(([k]) => `"${k}": bool`).join(', ')}, "note": "one short sentence on the worst problem, or 'fine'"}`,
      },
      { role: 'user', content: line },
    ],
    temperature: 0,
    max_tokens: 250,
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
  const jobs = SCENARIOS.flatMap((scenario) => Array.from({ length: SAMPLES }, (_, sample) => ({ scenario, sample })))
  const results: Line[] = new Array(jobs.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= jobs.length) return
      const { scenario, sample } = jobs[i]
      const params = scenario.kind === 'session' ? SESSION_COMMENT_PARAMS : ENTRY_REMARK_PARAMS
      const line =
        (
          await openai.chat.completions.create({
            ...params,
            messages: [
              { role: 'system', content: scenario.system },
              { role: 'user', content: scenario.input },
            ],
          })
        ).choices[0]?.message?.content?.trim() || ''
      const breaches = checkCoachLine(line, {
        kind: scenario.kind,
        aheadKind: scenario.kind === 'session' ? scenario.aheadKind : undefined,
      })
      const { judge, note } = await judgeLine(openai, scenario, line)
      results[i] = { scenario, sample, line, breaches, judge, note }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

function report(results: Line[]): string {
  const checkerRules = ['banned-word', 'scold', 'score-number', 'emoji', 'exclamation', 'too-long', 'looks-ahead', 'empty']
  const judgeRules = [...JUDGE, ...JUDGE_SESSION].map(([k]) => k as string)
  const L: string[] = []
  L.push('# Coach voice lines', '')
  L.push(`Date: ${new Date().toISOString().slice(0, 10)}. ${results.length} lines, ${SAMPLES} per scenario.`, '')
  L.push(`Session params: \`${JSON.stringify(SESSION_COMMENT_PARAMS)}\``)
  L.push(`Entry params: \`${JSON.stringify(ENTRY_REMARK_PARAMS)}\``, '')
  L.push('| rule | kind | lines breaching |', '|---|---|---|')
  for (const r of checkerRules) L.push(`| ${r} | checker | ${results.filter((x) => x.breaches.some((b) => b.rule === r)).length} |`)
  for (const r of judgeRules) L.push(`| ${r} | judge | ${results.filter((x) => r in x.judge && !x.judge[r]).length} |`)
  L.push('')
  L.push(`Lines with any checker breach: ${results.filter((x) => x.breaches.length > 0).length}. Lines failing any judge rule: ${results.filter((x) => Object.values(x.judge).some((v) => !v)).length}.`, '')
  for (const s of SCENARIOS) {
    L.push(`## ${s.kind}: ${s.id}`, '')
    for (const line of s.input.split('\n')) L.push(`- ${line}`)
    L.push('')
    for (const r of results.filter((x) => x.scenario === s)) {
      L.push(`> ${r.line.replace(/\n/g, '\n> ')}`, '')
      const failed = Object.entries(r.judge).filter(([, v]) => !v).map(([k]) => k)
      if (r.breaches.length) L.push(`- checker: ${r.breaches.map((b) => `${b.rule} ("${b.found}")`).join(', ')}`)
      if (failed.length) L.push(`- judge: ${failed.join(', ')}`)
      L.push(`- note: ${r.note}`, '')
    }
  }
  return L.join('\n')
}

it('reads the coach lines against the voice', async () => {
  const results = await run()
  const text = report(results)
  process.stdout.write(text + '\n')
  writeFileSync(path.join(process.cwd(), REPORT), text + '\n')
  expect(results.every((r) => r.line.length > 0)).toBe(true)
}, 1_800_000)
