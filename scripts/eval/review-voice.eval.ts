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
    bestDays: ['Monday'],
  }),
  week('leisure-week', [['Entertainment', 30], ['Sleep', 60], ['Meals', 10], ['Shallow Work', 6]], {
    bestDays: ['Wednesday'],
    bestHours: ['2 PM'],
  }),
  week('thin-week', [['Deep Work', 3], ['Meals', 1]], {
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
] as const

const judgeRules = (k: 'day' | 'week') => [...JUDGE_BOTH, ...(k === 'day' ? JUDGE_DAY : JUDGE_WEEK)]

// total_not_judged is graded on its own, one sentence at a time. It used to
// be one more rule in the call above ("The total hours logged are not praised
// or criticised"), and the judge failed nearly every week line that stated
// hours, with the stock note "total hours logged are judged". Given a fuller
// rule in that same call it still failed all eight CALIBRATION lines that
// keep it; asked yes or no of each sentence it read every "consider
// scheduling" as a breach. Sorting each sentence into a kind separates the
// two sets. CALIBRATION below is graded before every run and printed with it.
const RECORD_RULE = 'total_not_judged'
// Each sentence is put in one of these kinds; the first three break the rule.
const RECORD_KINDS = {
  about_the_record:
    'remarks on the record itself: how many days or hours were written down or logged, how complete, full or thin the log or the data is, or what that suggests. "You logged all seven days." "This week held three days of logging." "There were only 2 days with any time logged." "There is not enough data to determine your best focus days." "Only two days had any time logged, indicating limited activity."',
  suggests_recording:
    'suggests logging, recording, tracking or writing something down. "You might consider logging more focused work next week." "You could consider logging some time with friends."',
  sleep_was_the_largest:
    'says in words that sleep was the largest, biggest or main part of the week. "Sleep took up most of your week." "Sleep was the biggest category."',
  sleep_hours:
    'gives the hours of sleep and nothing more. "Sleep came to 40 hours." "You slept 45 hours."',
  what_the_time_went_to:
    'states what the time went to, an activity and its hours, which activity other than sleep took the most time (rest is not sleep), or a pattern such as which days or hours, even if it uses the word "logged". "You spent 22 hours on deep work." "You also logged 8 hours in meetings and 9 hours for meals." "Your best focus days were Tuesday and Thursday."',
  no_time_with_people:
    'says there was no time with friends or family, however it is worded and even if it uses "logged" or "log". "No time with friends or family was logged this week." "You did not log any time with friends or family."',
  suggests_doing:
    'suggests doing or scheduling an activity. "You could schedule more deep work at 9 AM on Tuesday." "Consider scheduling some time with friends on Saturday."',
  other: 'anything else.',
} as const
const RECORD_BREAKS = ['about_the_record', 'suggests_recording', 'sleep_was_the_largest']

async function judgeRecord(openai: OpenAI, line: string): Promise<{ kept: boolean; note: string }> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are sorting the sentences of a weekly review written from a time log. Answer strictly as JSON.

Split the review into its sentences and give each the one kind that fits it best:
${Object.entries(RECORD_KINDS).map(([k, d]) => `- ${k}: ${d}`).join('\n')}

If any clause of a sentence remarks on how much was recorded or how complete it is, the sentence is about_the_record even when the rest of it states hours. A fact introduced by "the data shows" or "the week held" is still what_the_time_went_to. A sentence that suggests doing an activity is suggests_doing, not suggests_recording, unless it asks for something to be logged or recorded. Judge only what each sentence is about; ignore its tone and accuracy.
Respond with JSON only: {"sentences": [{"text": "the sentence", "kind": "one of the kinds"}]}`,
      },
      { role: 'user', content: line },
    ],
    temperature: 0,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  })
  let parsed: { sentences?: { text?: unknown; kind?: unknown }[] } = {}
  try {
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}')
  } catch {
    parsed = {}
  }
  if (!Array.isArray(parsed.sentences) || parsed.sentences.length === 0) {
    return { kept: false, note: 'record judge gave no answer' }
  }
  const broken = parsed.sentences.filter((x) => RECORD_BREAKS.includes(String(x.kind)))
  return { kept: broken.length === 0, note: broken.map((x) => `${String(x.kind)}: "${String(x.text ?? '')}"`).join(' ') }
}

interface Line {
  scenario: Scenario
  sample: number
  line: string
  breaches: VoiceBreach[]
  judge: Record<string, boolean>
  note: string
}

const out = (s = '') => process.stdout.write(s + '\n')

async function judgeLine(
  openai: OpenAI,
  kind: 'day' | 'week',
  input: string,
  line: string
): Promise<{ judge: Record<string, boolean>; note: string }> {
  const rules = judgeRules(kind)
  const [judge, record] = await Promise.all([
    openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are grading one ${kind} review line written from a time log. Answer strictly as JSON.

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
    }),
    kind === 'week' ? judgeRecord(openai, line) : null,
  ])
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(judge.choices[0]?.message?.content || '{}')
  } catch {
    parsed = {}
  }
  const verdicts: Record<string, boolean> = {}
  for (const [k] of rules) verdicts[k] = parsed[k] === true
  let note = String(parsed.note ?? '')
  if (record) {
    verdicts[RECORD_RULE] = record.kept
    if (!record.kept) note += ` ${RECORD_RULE}: ${record.note}`
  }
  return { judge: verdicts, note }
}

// Week lines with a known total_not_judged answer, graded before the run so
// the report shows whether the judge can tell them apart. "Keeps" lines are
// from the run of 2026-11-15 (6a8f7e3), which the owner read and found do
// not remark on the log; "breaks" lines are from the run before it
// (3a15c1e), some trimmed, or are the owner's examples, and the sleep one
// was written for this check. A line marked * quotes one
// of the examples in the rule itself, so it is a weaker test.
const CALIBRATION: { scenario: string; keeps: boolean; quoted?: boolean; line: string }[] = [
  { scenario: 'full-week', keeps: true, quoted: true, line: 'You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. Best focus days were Tuesday and Thursday. You might consider scheduling more deep work during the 9 AM hour on those days.' },
  { scenario: 'full-week', keeps: true, quoted: true, line: 'You spent 22 hours on deep work, with best focus hours at 9 AM and 10 AM on Tuesday and Thursday. You also logged 8 hours in meetings and 9 hours for meals. The data shows that your best focus days were Tuesday and Thursday. You could schedule more deep work during your best focus hours next week.' },
  { scenario: 'focus-only', keeps: true, quoted: true, line: 'You spent 38 hours on deep work and 10 hours on shallow work. Your best focus days were Tuesday and Thursday, with your best focus hours at 8 AM and 9 AM. You logged no time with friends or family this week. You might consider scheduling some shallow work during your best focus hours on Tuesday.' },
  { scenario: 'partial', keeps: true, line: 'You spent 9 hours on deep work, with best focus hours at 9 AM and 10 AM on Monday. You also logged 1 hour of exercise. The data shows that your best focus day was Monday. You might consider scheduling another deep work session on Monday morning at 9 AM.' },
  { scenario: 'thin-week', keeps: true, line: 'This week held 3 hours of deep work and 1 hour for meals. Your best focus day was Monday, with the best focus hour at 10 AM. You could consider scheduling more deep work sessions on Monday at 10 AM.' },
  { scenario: 'leisure-week', keeps: true, quoted: true, line: 'This week held 30 hours of entertainment and 6 hours of shallow work. You spent your best focus day on Wednesday, with your best focus hour at 2 PM. You did not log any time with friends or family. You could consider scheduling a focused work session on Wednesday at 2 PM.' },
  { scenario: 'meetings-week', keeps: true, quoted: true, line: 'You spent 20 hours on deep work, with best focus days on Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. No time with friends or family was logged this week. You could plan to schedule more time for meals on Tuesday.' },
  { scenario: 'faith-week', keeps: true, line: 'You spent 18 hours on deep work, with your best focus days being Tuesday and Thursday. Your best focus hours were at 9 AM and 10 AM. You also spent 8 hours on meals and 5 hours on faith. Consider scheduling more deep work during your best focus hours next week.' },
  // These two were graded broken in the first run with the sorted judge: a
  // sentence giving sleep's hours, and rest (not sleep) taking the most time.
  { scenario: 'faith-week', keeps: true, quoted: true, line: 'You spent 18 hours on deep work this week. Your best focus days were Tuesday and Thursday, with your best focus hours at 9 AM and 10 AM. You logged 8 hours for meals and 5 hours for faith. You had 52 hours of sleep.' },
  { scenario: 'sleep-heavy', keeps: true, line: 'You spent 10 hours resting, 6 hours on chores, and 3 hours on calls. The most time was dedicated to rest. You could consider scheduling more calls on Tuesday.' },
  { scenario: 'full-week', keeps: false, quoted: true, line: 'This week held 22 hours of deep work, with best focus days on Tuesday and Thursday. The best focus hours were at 9 AM and 10 AM. You logged all seven days, with no hours unaccounted for. Consider scheduling more deep work during your best focus hours next week.' },
  { scenario: 'focus-only', keeps: false, line: 'This week included 38 hours of deep work and 10 hours of shallow work, with all seven days logged. The best focus days were Tuesday and Thursday, with the best focus hours at 8 AM and 9 AM. You could consider scheduling some shallow work during your best focus hours on Tuesday.' },
  { scenario: 'partial', keeps: false, quoted: true, line: 'This week held three days of logging, with 9 hours of deep work recorded. The best focus day was Monday, with focused hours at 9 AM and 10 AM. You might consider scheduling additional focused work on Monday during the best focus hours.' },
  { scenario: 'partial', keeps: false, line: 'This week held 9 hours of deep work, all on Monday during the best focus hours of 9 AM and 10 AM. Sleep accounted for 22 hours, and there was 1 hour of exercise. You could consider logging additional activities on Tuesday or Wednesday.' },
  { scenario: 'thin-week', keeps: false, quoted: true, line: 'This week included 3 hours of deep work, all logged on Monday during the best focus hour of 10 AM. You logged 1 hour for meals. There were only 2 days with any time logged. You could consider adding more activities on Wednesday, as it currently has no logged hours.' },
  { scenario: 'thin-week', keeps: false, quoted: true, line: 'This week held 3 hours of deep work and 1 hour for meals. Only two days had any time logged, indicating limited activity. You could schedule deep work on Monday at 10 AM.' },
  { scenario: 'sleep-heavy', keeps: false, quoted: true, line: 'You spent 10 hours resting, 6 hours on chores and 3 hours on calls. There is not enough data to determine your best focus days or hours. You might consider recording focused work next week to capture more details.' },
  { scenario: 'leisure-week', keeps: false, line: 'This week held 30 hours of entertainment and 10 hours for meals. Wednesday was the best focus day. You might consider logging some time with friends or family on a day like Saturday.' },
  { scenario: 'sleep-heavy', keeps: false, line: 'Sleep was the biggest part of your week at 63 hours, well ahead of 10 hours of rest and 6 hours of chores. You could schedule a call on Wednesday evening.' },
  // Written after the review found that 9 of 19 lines above quote the rule.
  // None of these repeats an example from RECORD_KINDS; same kinds of line.
  { scenario: 'meetings-week', keeps: true, line: 'Meetings took 14 hours and deep work 20 hours. Focus clustered on Tuesday and Thursday, mostly around 9 AM and 10 AM. Friends and family do not appear in the week. You could book a call on Wednesday evening.' },
  { scenario: 'full-week', keeps: true, line: 'Exercise came to 4 hours and social time to 6 hours, against 22 hours of deep work. Entertainment took 7 hours. Next week, you could move a workout to Wednesday at 7 AM.' },
  { scenario: 'faith-week', keeps: true, line: 'Faith took 5 hours this week, next to 18 hours of deep work and 8 hours of meals. Late mornings on Tuesday and Thursday held the most focus. You might add a short walk on Friday afternoon.' },
  { scenario: 'leisure-week', keeps: true, line: 'Entertainment filled 30 hours, with 10 hours going to meals and 6 to shallow work. Wednesday around 2 PM held the most focus. An hour of deep work there on Wednesday is one option.' },
  { scenario: 'partial', keeps: true, line: 'So far this week, deep work has taken 9 hours and exercise 1 hour. Monday at 9 AM was where focus landed. You could try a second focus block on Tuesday at 9 AM.' },
  { scenario: 'sleep-heavy', keeps: true, line: 'Chores took 6 hours and rest 10 hours, with 3 hours of calls. Apart from sleep, rest took the most time. A call on Saturday morning is one option.' },
  { scenario: 'full-week', keeps: false, line: 'Deep work took 22 hours across the week, and every day has an entry. Nothing is missing from the record. You could try a morning workout on Friday.' },
  { scenario: 'thin-week', keeps: false, line: 'Deep work took 3 hours and meals 1 hour. Most of the week is blank, so the picture is incomplete. You could schedule deep work on Monday at 10 AM.' },
  { scenario: 'partial', keeps: false, line: 'Deep work took 9 hours so far. You have written down just one day of this week. Try noting your afternoons too, starting Tuesday.' },
  { scenario: 'meetings-week', keeps: false, line: 'Meetings took 14 hours and deep work 20 hours. Track your evenings next week so the totals are fuller.' },
  { scenario: 'leisure-week', keeps: false, line: 'Sleep made up most of the week at 60 hours, with entertainment next at 30. You could schedule a walk on Wednesday.' },
  { scenario: 'faith-week', keeps: false, line: 'Sleep took the largest share of the week, at 52 hours, ahead of 18 hours of deep work. You could schedule deep work on Tuesday at 9 AM.' },
  { scenario: 'sleep-heavy', keeps: false, line: 'Rest took 10 hours, chores 6 and calls 3. The log is too sparse to say when focus happens. You might add your work hours on Monday.' },
]

async function calibrate(openai: OpenAI) {
  const rows = await Promise.all(
    CALIBRATION.map(async (c) => {
      const { kept, note } = await judgeRecord(openai, c.line)
      return { ...c, got: kept, note: note || 'fine' }
    })
  )
  const right = (keeps: boolean, q?: boolean) =>
    rows.filter((r) => r.keeps === keeps && r.got === keeps && (q === undefined || !!r.quoted === q)).length
  const total = (keeps: boolean, q?: boolean) =>
    rows.filter((r) => r.keeps === keeps && (q === undefined || !!r.quoted === q)).length
  const L: string[] = []
  L.push('## Judge check: total_not_judged on lines with a known answer')
  L.push('')
  L.push(`Lines NOT quoted in the rule (the real test): kept graded kept ${right(true, false)} of ${total(true, false)}; broken graded broken ${right(false, false)} of ${total(false, false)}.`)
  L.push(`Lines that quote the rule (*, weaker): kept graded kept ${right(true, true)} of ${total(true, true)}; broken graded broken ${right(false, true)} of ${total(false, true)}.`)
  L.push(`All lines: kept ${right(true)} of ${total(true)}; broken ${right(false)} of ${total(false)}. (* repeats an example given in the rule.)`)
  L.push('')
  for (const r of rows) {
    const ok = r.got === r.keeps
    L.push(`- ${ok ? 'right' : 'WRONG'} · should ${r.keeps ? 'keep' : 'break'}${r.quoted ? ' *' : ''} · ${r.scenario} · "${r.line}" · note: ${r.note}`)
  }
  return L.join('\n')
}

function promptFor(s: Scenario): { messages: OpenAI.Chat.ChatCompletionMessageParam[]; input: string } {
  if (s.kind === 'day') {
    const p = buildDayReviewPrompt(s.input)
    return { messages: [{ role: 'user', content: p }], input: p }
  }
  const context = buildWeekReviewContext(s.input)
  return {
    messages: [
      { role: 'system', content: buildWeekReviewSystemPrompt(s.input) },
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

      const { judge, note } = await judgeLine(openai, scenario.kind, input, line)
      results[i] = { scenario, sample, line, breaches, judge, note }
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
const JUDGE_RULES = [...[...JUDGE_BOTH, ...JUDGE_DAY, ...JUDGE_WEEK].map(([k]) => k as string), RECORD_RULE]

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
    `week: ${i.isPartialWeek ? 'in progress' : 'finished'}`,
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
  loadEnv()
  const check = await calibrate(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))
  // EVAL_CALIBRATE_ONLY=1 grades the known lines and stops: a cheap way to
  // try a change to the judge before spending a full run on it.
  if (process.env.EVAL_CALIBRATE_ONLY) {
    out(check)
    return
  }
  const results = await run()
  const { text: lines } = report(results)
  const text = lines.replace(/\n## day: /, `\n${check}\n\n## day: `)
  out(text)
  if (process.env.EVAL_REPORT) writeFileSync(path.join(process.cwd(), process.env.EVAL_REPORT), text + '\n')
  expect(results.every((r) => r.line.length > 0)).toBe(true)
}, 1_800_000)
