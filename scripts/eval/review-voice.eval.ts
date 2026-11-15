/**
 * @jest-environment node
 *
 * Voice evaluation for the day and week review lines.
 *
 * Asks the real model for lines across invented days and weeks, using the
 * prompts production sends (src/lib/prompts.ts), checks each line against
 * the rules a machine can check (checkReviewLine) and has a second model
 * grade the rest. The numbers point at where to look; every line is printed
 * because the point is that they get read.
 *
 *   EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import {
  buildDayReviewPrompt,
  buildWeekReviewContext,
  buildWeekReviewSystemPrompt,
  peopleMinutes,
  DAY_REVIEW_PARAMS,
  WEEK_REVIEW_PARAMS,
  type DayReviewPromptInput,
  type WeekReviewContextInput,
} from '../../src/lib/prompts'
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

type Hours = { label: string; minutes: number }[]
const mins = (h: Hours) => h.reduce((n, c) => n + c.minutes, 0)

interface DayScenario {
  kind: 'day'
  id: string
  input: DayReviewPromptInput
}
interface WeekScenario {
  kind: 'week'
  id: string
  input: WeekReviewContextInput
}
type Scenario = DayScenario | WeekScenario

function day(
  id: string,
  hours: Hours,
  extra: Partial<DayReviewPromptInput> = {}
): DayScenario {
  return {
    kind: 'day',
    id,
    input: { totalMinutesLogged: mins(hours), hours, ...extra },
  }
}

const h = (n: number) => n * 60

const DAY_SCENARIOS: DayScenario[] = [
  day(
    'focus-heavy',
    [{ label: 'Deep Work', minutes: 240 }, { label: 'Meals', minutes: 60 }, { label: 'Sleep', minutes: 450 }],
    {
      metrics: { body: 52, focus: 84, social: 20 },
      longestFocusSession: { activity: 'Essay draft', minutes: 150 },
      wins: [{ text: '2h 30m focus session on "Essay draft"' }],
      plan: { kept: 3, moved: 0, missed: 0 },
    }
  ),
  day(
    'full-day',
    [
      { label: 'Deep Work', minutes: 180 },
      { label: 'Exercise', minutes: 60 },
      { label: 'Social', minutes: 120 },
      { label: 'Meals', minutes: 90 },
      { label: 'Sleep', minutes: 480 },
    ],
    { metrics: { body: 88, focus: 82, social: 85 }, mood: 'great' }
  ),
  day('thin', [{ label: 'Shallow Work', minutes: 45 }], { metrics: { body: 20, focus: 25, social: 5 } }),
  day(
    'leisure',
    [{ label: 'Entertainment', minutes: 300 }, { label: 'Meals', minutes: 60 }, { label: 'Sleep', minutes: 540 }],
    { metrics: { body: 35, focus: 5, social: 5 } }
  ),
  day('low-mood', [{ label: 'Deep Work', minutes: 60 }, { label: 'Entertainment', minutes: 240 }], {
    metrics: { body: 20, focus: 40, social: 5 },
    mood: 'low',
  }),
  day('plan-missed', [{ label: 'Meetings', minutes: 240 }, { label: 'Admin', minutes: 90 }], {
    metrics: { body: 15, focus: 30, social: 10 },
    plan: { kept: 0, moved: 1, missed: 3 },
  }),
  day('body-day', [{ label: 'Exercise', minutes: 120 }, { label: 'Chores', minutes: 120 }, { label: 'Calls', minutes: 45 }], {
    metrics: { body: 80, focus: 10, social: 45 },
  }),
  day('work-only', [{ label: 'Deep Work', minutes: 360 }, { label: 'Shallow Work', minutes: 120 }, { label: 'Meals', minutes: 30 }], {
    metrics: { body: 25, focus: 90, social: 0 },
    longestFocusSession: { activity: 'Quarterly model', minutes: 200 },
  }),
  day('sleep-only', [{ label: 'Sleep', minutes: 480 }], { metrics: { body: 40, focus: 0, social: 0 } }),
  day('even', [{ label: 'Learning', minutes: 150 }, { label: 'Movement', minutes: 30 }, { label: 'Social', minutes: 60 }, { label: 'Rest', minutes: 60 }], {
    metrics: { body: 45, focus: 55, social: 50 },
    mood: 'okay',
  }),
  day('faith-day', [{ label: 'Faith', minutes: 60 }, { label: 'Deep Work', minutes: 180 }, { label: 'Meals', minutes: 60 }]),
  day('meetings-and-faith', [{ label: 'Meetings', minutes: 240 }, { label: 'Faith', minutes: 30 }]),
]

function week(
  id: string,
  cats: [string, number][],
  extra: Partial<WeekReviewContextInput> = {}
): WeekScenario {
  return {
    kind: 'week',
    id,
    input: {
      isPartialWeek: false,
      daysSoFar: 7,
      daysLogged: 7,
      bestDays: ['Tuesday', 'Thursday'],
      bestHours: ['9 AM', '10 AM'],
      categories: cats.map(([label, hours]) => ({ label, minutes: h(hours) })),
      ...extra,
    },
  }
}

const WEEK_SCENARIOS: WeekScenario[] = [
  week('full-week', [['Sleep', 52], ['Deep Work', 22], ['Meetings', 8], ['Exercise', 4], ['Social', 6], ['Meals', 9], ['Entertainment', 7]]),
  week('focus-only', [['Deep Work', 38], ['Shallow Work', 10], ['Sleep', 44], ['Meals', 5]], {
    bestHours: ['8 AM', '9 AM'],
  }),
  week('partial', [['Deep Work', 9], ['Sleep', 22], ['Exercise', 1]], {
    isPartialWeek: true,
    daysSoFar: 3,
    daysLogged: 3,
    bestDays: ['Monday'],
  }),
  week('leisure-week', [['Entertainment', 30], ['Sleep', 60], ['Meals', 10], ['Shallow Work', 6]], {
    bestDays: ['Wednesday'],
    bestHours: ['2 PM'],
  }),
  week('thin-week', [['Deep Work', 3], ['Meals', 1]], {
    daysLogged: 2,
    bestDays: ['Monday'],
    bestHours: ['10 AM'],
  }),
  week('sleep-heavy', [['Sleep', 63], ['Rest', 10], ['Calls', 3], ['Chores', 6]], {
    bestDays: [],
    bestHours: [],
  }),
  week('meetings-week', [['Sleep', 50], ['Deep Work', 20], ['Meetings', 14], ['Meals', 7]]),
  week('faith-week', [['Sleep', 52], ['Deep Work', 18], ['Faith', 5], ['Meals', 8]]),
]

const JUDGE_BOTH = [
  ['no_evaluation', 'The line does not say or imply the day, the week or the person was good, bad, strong, weak, enough or not enough (for a week line, ignore its one suggestion sentence).'],
  ['grounded', 'Every number, activity and category in the line appears in the input. Nothing is invented.'],
  ['no_consolation', 'No reassurance, sympathy or encouragement.'],
] as const
const JUDGE_DAY = [['no_advice', 'Nothing is suggested or recommended.']] as const
const JUDGE_WEEK = [
  ['one_suggestion', 'At most one sentence suggests something, and it names a specific day, hour or activity.'],
  ['total_not_judged', 'The total hours logged are not praised or criticised, and sleep being the largest category is not presented as a finding.'],
] as const

const judgeRules = (k: 'day' | 'week') => [...JUDGE_BOTH, ...(k === 'day' ? JUDGE_DAY : JUDGE_WEEK)]

interface Line {
  scenario: Scenario
  sample: number
  line: string
  breaches: VoiceBreach[]
  judge: Record<string, boolean>
  note: string
}

const out = (s = '') => process.stdout.write(s + '\n')

function promptFor(s: Scenario): { messages: OpenAI.Chat.ChatCompletionMessageParam[]; input: string } {
  if (s.kind === 'day') {
    const p = buildDayReviewPrompt(s.input)
    return { messages: [{ role: 'user', content: p }], input: p }
  }
  const context = buildWeekReviewContext(s.input)
  return {
    messages: [
      { role: 'system', content: buildWeekReviewSystemPrompt() },
      { role: 'user', content: context },
    ],
    input: context,
  }
}

async function run(): Promise<Line[]> {
  loadEnv()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const all: Scenario[] = [...DAY_SCENARIOS, ...WEEK_SCENARIOS]
  const jobs = all.flatMap((scenario) => Array.from({ length: SAMPLES }, (_, sample) => ({ scenario, sample })))
  const results: Line[] = new Array(jobs.length)

  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= jobs.length) return
      const { scenario, sample } = jobs[i]
      const { messages, input } = promptFor(scenario)
      const params = scenario.kind === 'day' ? DAY_REVIEW_PARAMS : WEEK_REVIEW_PARAMS
      const line =
        (await openai.chat.completions.create({ ...params, messages })).choices[0]?.message?.content?.trim() || ''

      const mood = scenario.kind === 'day' ? scenario.input.mood ?? null : null
      const withPeople = peopleMinutes(
        scenario.kind === 'day' ? scenario.input.hours ?? [] : scenario.input.categories
      )
      const breaches = checkReviewLine(line, {
        kind: scenario.kind,
        mood,
        peopleMinutes: withPeople,
        isPartialWeek: scenario.kind === 'week' ? scenario.input.isPartialWeek : undefined,
      })

      const rules = judgeRules(scenario.kind)
      const judge = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are grading one ${scenario.kind} review line written from a time log. Answer strictly as JSON.

THE EXACT INPUT THE WRITER HAD:
${input}

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
        parsed = JSON.parse(judge.choices[0]?.message?.content || '{}')
      } catch {
        parsed = {}
      }
      const verdicts: Record<string, boolean> = {}
      for (const [k] of rules) verdicts[k] = parsed[k] === true
      results[i] = { scenario, sample, line, breaches, judge: verdicts, note: String(parsed.note ?? '') }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

const CHECKER_RULES = [
  'banned-word', 'verdict', 'exclamation', 'question', 'emoji', 'score-talk',
  'relative-day', 'advice', 'correction', 'hard-day', 'false-absence', 'day-absence', 'absence-wording',
  'absence-unsaid', 'partial-week-absence', 'label-read-back', 'too-long', 'list', 'empty',
]
const JUDGE_RULES = [...JUDGE_BOTH, ...JUDGE_DAY, ...JUDGE_WEEK].map(([k]) => k as string)

function describeInput(s: Scenario): string[] {
  if (s.kind === 'day') {
    const i = s.input
    const l = (i.hours ?? []).map((c) => `${c.label} ${c.minutes} min`)
    return [
      `hours: ${l.join(', ')}`,
      i.mood ? `mood: ${i.mood}` : '',
      i.longestFocusSession ? `focus session: ${i.longestFocusSession.minutes} min on "${i.longestFocusSession.activity}"` : '',
      i.plan ? `plan: ${i.plan.kept} kept, ${i.plan.moved} moved, ${i.plan.missed} missed` : '',
      i.metrics ? `scores (not shown to the model after the rewrite): Body ${i.metrics.body}, Mind ${i.metrics.focus}, Heart ${i.metrics.social}` : '',
    ].filter(Boolean)
  }
  const i = s.input
  return [
    `days covered: ${i.isPartialWeek ? `${i.daysSoFar} of 7 (in progress)` : 'all 7'}; days with anything logged: ${i.daysLogged}`,
    `hours: ${i.categories.map((c) => `${c.label} ${c.minutes / 60}h`).join(', ')}`,
    `best days: ${i.bestDays.join(', ') || 'none'}; best hours: ${i.bestHours.join(', ') || 'none'}`,
  ]
}

function report(results: Line[]): { text: string; checkerCounts: Record<string, number>; judgeCounts: Record<string, number>; judgeFailLines: number } {
  const checkerCounts: Record<string, number> = {}
  for (const r of CHECKER_RULES) checkerCounts[r] = results.filter((x) => x.breaches.some((b) => b.rule === r)).length
  const judgeCounts: Record<string, number> = {}
  for (const r of JUDGE_RULES) {
    const applicable = results.filter((x) => r in x.judge)
    judgeCounts[r] = applicable.filter((x) => !x.judge[r]).length
  }
  const judgeFailLines = results.filter((x) => Object.values(x.judge).some((v) => !v)).length

  const L: string[] = []
  L.push(`# Review voice lines`)
  L.push('')
  L.push(`Date: ${new Date().toISOString().slice(0, 10)}. ${results.length} lines, ${SAMPLES} per scenario.`)
  L.push('')
  L.push(`Day params: \`${JSON.stringify(DAY_REVIEW_PARAMS)}\``)
  L.push(`Week params: \`${JSON.stringify(WEEK_REVIEW_PARAMS)}\``)
  L.push('')
  L.push('| rule | kind | lines breaching |')
  L.push('|---|---|---|')
  for (const r of CHECKER_RULES) L.push(`| ${r} | checker | ${checkerCounts[r]} |`)
  for (const r of JUDGE_RULES) L.push(`| ${r} | judge | ${judgeCounts[r]} |`)
  L.push('')
  L.push(`Lines with any checker breach: ${results.filter((x) => x.breaches.length > 0).length}. Lines failing any judge rule: ${judgeFailLines}.`)
  L.push('')
  const noneWeeks = results.filter(
    (x) => x.scenario.kind === 'week' && !x.scenario.input.isPartialWeek && peopleMinutes(x.scenario.input.categories) === 0
  )
  L.push(`Full-week lines with no time with friends or family in the input: ${noneWeeks.length}. Of those, lines that say "friends or family": ${noneWeeks.filter((x) => /friends or family/i.test(x.line)).length}.`)
  L.push('')
  for (const s of Array.from(new Set(results.map((x) => x.scenario)))) {
    L.push(`## ${s.kind}: ${s.id}`)
    L.push('')
    for (const d of describeInput(s)) L.push(`- ${d}`)
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
  return { text: L.join('\n'), checkerCounts, judgeCounts, judgeFailLines }
}

it('reads the review lines against the voice', async () => {
  const results = await run()
  const { text } = report(results)
  out(text)
  if (process.env.EVAL_REPORT) writeFileSync(path.join(process.cwd(), process.env.EVAL_REPORT), text + '\n')
  expect(results.every((r) => r.line.length > 0)).toBe(true)
}, 1_800_000)
