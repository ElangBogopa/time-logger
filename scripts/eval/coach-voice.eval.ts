/**
 * @jest-environment node
 *
 * Voice evaluation for the session comment and the per-entry remark.
 *
 * Asks the real model for lines across invented sessions and entries, using
 * the prompts and params production sends (src/lib/prompts.ts), checks each
 * line against the rules a machine can check (checkCoachLine for the voice,
 * checkCoachGrounding for what the facts do and do not say) and has a second
 * model grade the rest. Every line is printed because the point is that they
 * get read.
 *
 * Before it grades anything the judge is asked about the fixed lines in
 * coach-grounding-cases.ts, whose answers are known. The report shows what it
 * said, and the run fails if the answer the eval would give for any of them
 * (checker and judge together) is wrong.
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
  type SessionFacts,
  type EntryFacts,
} from '../../src/lib/coach-facts'
import {
  SESSION_COMMENT_PARAMS,
  ENTRY_REMARK_PARAMS,
  buildSessionCommentarySystemPrompt,
  buildEntryRemarkSystemPrompt,
  describeSessionFacts,
  describeEntryFacts,
} from '../../src/lib/prompts'
import { checkCoachLine, checkCoachGrounding, COACH_GROUNDING_RULES } from '../../src/lib/coach-voice-check'
import { GROUNDING_CASES, type GroundingCase } from './coach-grounding-cases'
import type { VoiceBreach } from '../../src/lib/review-voice-check'
import { windowsForWake } from '../../src/lib/ideal-day'
import type { PlanRow } from '../../src/lib/plan-adherence'
import type { TimePeriod, TimeCategory } from '../../src/lib/types'

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 6)
const SAMPLES = Number(process.env.EVAL_SAMPLES || 3)
const REPORT = process.env.EVAL_REPORT || 'docs/voice-lines/coach.md'
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'gpt-4o'

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
  facts: SessionFacts
  system: string
  input: string
}
interface EntryScenario {
  kind: 'entry'
  id: string
  facts: EntryFacts
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
    facts,
    system: buildSessionCommentarySystemPrompt(facts.ahead.kind),
    input: describeSessionFacts(facts),
  }
}

function entry(id: string, target: CoachEntry, day: CoachEntry[]): EntryScenario {
  const facts = buildEntryFacts({ entry: target, dayEntries: day })
  return { kind: 'entry', id, facts, system: buildEntryRemarkSystemPrompt(facts), input: describeEntryFacts(facts) }
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

/**
 * "Is the line true to its facts?" is not asked as a yes or no. As one long
 * rule it was answered by feel: the judge failed lines for saying what the
 * facts do say ("Body and Mind are still open") and passed "there is still
 * time left today" for a day already over. It is asked instead to quote each
 * unsupported statement and name the fact, and a quote that is not in the
 * line is thrown away. The line is grounded when nothing is left.
 */
const HOW_TO_READ = `How to read the line against the facts:
- Rewording is not a claim. 15:00 is 3:00 PM, or just "3:00"; 90 minutes is an hour and a half; "watching TV" is "Watching TV". A figure that follows from the facts by adding or rounding is in the facts. Tone words ("solid", "a nice break", "well-placed", "valuable") are not claims.
- Body, Mind and Heart are the three rings; "the rings" or "the targets" means them. A ring's line gives its target ("N of M ..."), so that ring's target may be mentioned, and so may working toward it. Leaving a ring or a fact out is never unsupported.
- "X is still open" in the facts means X is open: not reached yet, time left for it. "X did not reach its target" means not met, not reached. Saying either in other words, or for several rings at once, is supported. Calling a ring open when its line says "did not reach" is unsupported.
- Nothing has a target except a ring that a line names. A target for an activity or a kind of activity (rest, entertainment, admin) is unsupported.
- A plan may be spoken of only if a "Plan kept", "Plan not done" or 'planned "..."' fact names it. "As planned" without one is unsupported, and so is saying there was no plan.
- Looking ahead is supported only by a "Still ahead" line, and only for what that line names. With no "Still ahead later today" line, saying there is still time today is unsupported. A "Plan not done" is past: saying it can still be done is unsupported unless "Still ahead" names it.`

const JUDGE = [
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

const plain = (t: string) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim()

async function judgeLine(openai: OpenAI, kind: 'session' | 'entry', input: string, line: string) {
  const rules = [...JUDGE, ...(kind === 'session' ? JUDGE_SESSION : [])]
  const res = await openai.chat.completions.create({
    model: JUDGE_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are checking one ${kind === 'session' ? 'session comment' : 'entry remark'} written by a coach from a time log. Answer strictly as JSON.

THE EXACT FACTS THE WRITER HAD:
${input}

FIRST, "unsupported": every statement in the line that the facts contradict or do not contain. For each, "quote" is the exact words copied from the line and "why" names the fact it contradicts or says what is missing. Check the "why" against the facts before you keep it: if a line of the facts says the same thing, it is supported and does not belong in the list. An empty list when there is nothing.

${HOW_TO_READ}

THEN grade each rule true (kept) or false (broken):
${rules.map(([k, d]) => `- ${k}: ${d}`).join('\n')}

Respond with JSON only: {"unsupported": [{"quote": "...", "why": "..."}], ${rules.map(([k]) => `"${k}": bool`).join(', ')}, "note": "one short sentence on the worst problem with the voice, or 'fine'"}`,
      },
      { role: 'user', content: line },
    ],
    temperature: 0,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  })
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}')
  } catch {
    parsed = {}
  }
  const listed = Array.isArray(parsed.unsupported) ? (parsed.unsupported as { quote?: unknown; why?: unknown }[]) : []
  const unsupported = listed
    .map((u) => ({ quote: String(u?.quote ?? ''), why: String(u?.why ?? '') }))
    .filter((u) => u.quote.trim().length > 0 && plain(line).includes(plain(u.quote)))
  const judge: Record<string, boolean> = { grounded: unsupported.length === 0 }
  for (const [k] of rules) judge[k] = parsed[k] === true
  const note = unsupported.length
    ? unsupported.map((u) => `"${u.quote}": ${u.why}`).join(' / ')
    : String(parsed.note ?? '')
  return { judge, note }
}

/** Every breach a machine finds in a line: the voice and the facts. */
function checkLine(
  line: string,
  s: { kind: 'session'; facts: SessionFacts } | { kind: 'entry'; facts: EntryFacts }
): VoiceBreach[] {
  return s.kind === 'session'
    ? [...checkCoachLine(line, { kind: 'session', aheadKind: s.facts.ahead.kind }), ...checkCoachGrounding(line, s)]
    : [...checkCoachLine(line, { kind: 'entry' }), ...checkCoachGrounding(line, s)]
}

const isGroundingRule = (rule: string) => (COACH_GROUNDING_RULES as readonly string[]).includes(rule)
/** The eval's answer to "is it true to its facts?": the checker's rules and the judge both find nothing. */
const trueToFacts = (r: { breaches: VoiceBreach[]; judge: Record<string, boolean> }) =>
  !r.breaches.some((b) => isGroundingRule(b.rule)) && r.judge.grounded

interface JudgeCheck {
  c: GroundingCase
  breaches: VoiceBreach[]
  judge: Record<string, boolean>
  note: string
  right: boolean
}

/** Ask the judge about the fixed lines, whose answers are known. */
async function checkJudge(openai: OpenAI): Promise<JudgeCheck[]> {
  return Promise.all(
    GROUNDING_CASES.map(async (c) => {
      const input = c.kind === 'session' ? describeSessionFacts(c.facts) : describeEntryFacts(c.facts)
      const breaches = checkLine(c.line, c).filter((b) => isGroundingRule(b.rule))
      const { judge, note } = await judgeLine(openai, c.kind, input, c.line)
      return { c, breaches, judge, note, right: trueToFacts({ breaches, judge }) === (c.rule === null) }
    })
  )
}

async function run(openai: OpenAI): Promise<Line[]> {
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
      const breaches = checkLine(line, scenario)
      const { judge, note } = await judgeLine(openai, scenario.kind, scenario.input, line)
      results[i] = { scenario, sample, line, breaches, judge, note }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

function report(results: Line[], checks: JudgeCheck[]): string {
  const checkerRules = [
    'banned-word', 'scold', 'score-number', 'emoji', 'exclamation', 'too-long', 'empty',
    ...COACH_GROUNDING_RULES,
  ]
  const judgeRules = ['grounded', ...[...JUDGE, ...JUDGE_SESSION].map(([k]) => k as string)]
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
  L.push(
    `**Lines not true to their facts: ${results.filter((x) => !trueToFacts(x)).length} of ${results.length}** (a checker rule from ${COACH_GROUNDING_RULES.join(', ')}, or the judge's \`grounded\`).`,
    ''
  )
  const wrong = checks.filter((k) => !k.right)
  const judgeAlone = checks.filter((k) => k.judge.grounded === (k.c.rule === null)).length
  L.push('## The judge, checked against lines whose answer is known', '')
  L.push(
    `Judge model: \`${JUDGE_MODEL}\`. ${checks.length - wrong.length} of ${checks.length} fixed lines got the right answer from the checker and the judge together${wrong.length ? ' — **the counts above cannot be trusted until this is all of them**' : ''}. The judge by itself was right on ${judgeAlone}.`,
    ''
  )
  L.push('| fixed line | true to its facts? | checker | judge | answer |', '|---|---|---|---|---|')
  for (const k of checks) {
    const found = [...new Set(k.breaches.map((b) => b.rule))].join(', ') || 'nothing'
    L.push(
      `| ${k.c.id} | ${k.c.rule === null ? 'yes' : `no (${k.c.rule})`} | ${found} | ${k.judge.grounded ? 'grounded' : `not grounded: ${k.note.replace(/\|/g, '/')}`} | ${k.right ? 'right' : '**WRONG**'} |`
    )
  }
  L.push('')
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
  loadEnv()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const checks = await checkJudge(openai)
  const results = await run(openai)
  const text = report(results, checks)
  process.stdout.write(text + '\n')
  writeFileSync(path.isAbsolute(REPORT) ? REPORT : path.join(process.cwd(), REPORT), text + '\n')
  expect(results.every((r) => r.line.length > 0)).toBe(true)
  // The judge must tell the fixed lines apart, or its counts mean nothing.
  expect(checks.filter((k) => !k.right).map((k) => k.c.id)).toEqual([])
}, 1_800_000)
