import { CATEGORIES, CATEGORY_LABELS, TimeCategory, TimeEntry } from '@/lib/types'
import { formatDurationLong } from '@/lib/time-utils'
import { SOCIAL_CATS } from '@/lib/metrics-calc'

/**
 * Prompts shared by the API routes and the evaluation harness in scripts/eval.
 *
 * They live here so an eval measures the text production actually sends. A
 * copy in the harness would drift the first time a route was edited, and a
 * passing eval against stale wording is worse than no eval.
 */

/**
 * The voice of the day and week reviews: facts, no praise, no consolation.
 * Raise PROMPT_VERSION in commentary-cache.ts (day line) and
 * COACH_PROMPT_VERSION in api/weekly-review/route.ts (week line) when this
 * changes, or lines written in the old voice keep being shown.
 * `npm run eval:voice` is how a wording change is checked: it asks the real
 * model for lines and reads each against this voice.
 */
export const REVIEW_BANNED_WORDS = [
  'impressive',
  'amazing',
  'great',
  'fantastic',
  'incredible',
  'solid',
  'commitment',
  'dedication',
  'showcasing',
  'crushed',
  'nailed',
  'well done',
  'kudos',
  'keep it up',
  'proud',
  'journey',
] as const

export const REVIEW_VOICE = `VOICE: plain, calm, specific. Short sentences that state what happened, using the numbers and activity names from the data.
- State facts. Do not evaluate the person or the day. No praise, no encouragement, no consolation.
- Never use these words or anything like them: ${REVIEW_BANNED_WORDS.join(', ')}.
- No exclamation marks, no emoji, no questions.
- Say nothing about an area that is missing from the data, and never state on your own that something was not logged. The one exception: when the data itself contains a full sentence saying that something was not logged, that sentence is a fact of the data like any other and your line must include it, once, flatly, in the data's own words. Leaving it out is a mistake. It is what was logged, not a failing.
Example of the register, from someone else's day (its facts are not this person's; never reuse its sentences): "Four hours of focused work, most of it in one block on the essay. A 30-minute walk."`

/**
 * What the reviews say about time with friends and family.
 *
 * It is counted as the Heart ring counts it: Social, Calls and Faith. Work
 * meetings are left out on purpose; a day of meetings is not a day with
 * friends or loved ones, and saying "no time with people" about it was false.
 *
 * The day review never says there was none: one day without it is not a
 * finding. A finished week that had none is told so, once, in a sentence in
 * the data (NO_FRIENDS_OR_FAMILY); a week still in progress is told nothing.
 * The voice carries no wording about it at all, because an example sentence
 * in the voice is what the model copied onto almost every line.
 */
const PEOPLE_LABELS: readonly string[] = SOCIAL_CATS.map((c) => CATEGORY_LABELS[c as TimeCategory])

/** Minutes of what the Heart ring counts: Social, Calls and Faith. Work meetings are left out on purpose. */
export function peopleMinutes(categories: { label: string; minutes: number }[]): number {
  return categories
    .filter((c) => PEOPLE_LABELS.includes(c.label) && c.minutes > 0)
    .reduce((n, c) => n + c.minutes, 0)
}

/** A sentence, not a label: a label and a colon was pasted back whole. */
export const NO_FRIENDS_OR_FAMILY = 'No time with friends or family was logged this week.'

/**
 * The labels the builders below write before a colon, so the checker can
 * recognise one pasted back into a line. review-people-line.test.ts fails if
 * a builder writes a label that is not listed here.
 */
export const REVIEW_DATA_LABELS = [
  'Time by category', 'Time tracked', 'Plan', 'Noted', 'Evening mood',
  'Longest focus session', 'Weekly Review Data', 'Days covered',
  'Days with anything logged', 'Best focus days', 'Best focus hours',
  'Hours by category',
] as const

export const DAY_REVIEW_PARAMS = { model: 'gpt-4o-mini', max_tokens: 150, temperature: 0.4 } as const
export const WEEK_REVIEW_PARAMS = { model: 'gpt-4o-mini', max_tokens: 200, temperature: 0.4 } as const

export interface DayReviewPromptInput {
  /** Body / Mind / Heart, each 0–99. */
  metrics?: { body: number; focus: number; social: number } | null
  /** Planned blocks with a time: how many were kept, moved or missed. */
  plan?: { kept: number; moved: number; missed: number } | null
  totalMinutesLogged: number
  // Optional: /api/day-summary stopped returning targetProgress when the
  // weekly targets system was removed, so the client omits it entirely.
  wins?: { text: string }[]
  targetProgress?: {
    label: string
    todayMinutes: number
    dailyTarget: number
    progress: number
    direction: 'at_least' | 'at_most'
    trend: 'up' | 'down' | 'same'
  }[]
  mood?: 'low' | 'okay' | 'great' | null
  longestFocusSession?: { activity: string; minutes: number } | null
  hours?: { label: string; minutes: number }[]
}

export function buildDayReviewPrompt(dayData: DayReviewPromptInput): string {
  // `metrics` and `targetProgress` are accepted and deliberately not put in
  // the prompt: the scores are on screen beside the line, and a model that
  // sees them can only turn them into a verdict.
  const wins = dayData.wins ?? []
  const winsText = wins.length > 0 ? `Noted: ${wins.map((w) => w.text).join(', ')}.` : ''
  const moodText = dayData.mood ? `Evening mood: ${dayData.mood}.` : ''
  const focusText = dayData.longestFocusSession
    ? `Longest focus session: ${dayData.longestFocusSession.minutes} minutes on "${dayData.longestFocusSession.activity}".`
    : ''

  const plan = dayData.plan
  const planned = plan ? plan.kept + plan.moved + plan.missed : 0
  const planText = plan && planned > 0
    ? `Plan: ${planned} timed ${planned === 1 ? 'block' : 'blocks'} — ${plan.kept} kept, ${plan.moved} done at another time, ${plan.missed} not done.`
    : ''

  const hours = Math.floor(dayData.totalMinutesLogged / 60)
  const minutes = dayData.totalMinutesLogged % 60

  const hoursList = (dayData.hours ?? [])
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((c) => `- ${c.label}: ${formatDurationLong(c.minutes)}`)
  const hoursText = hoursList.length > 0 ? hoursList.join('\n') : 'Nothing was broken down by category.'

  const logged = [
    'Time by category:',
    hoursText,
    `Time tracked: ${hours}h ${minutes}m (this only says how much was written down — do not praise or criticise it)`,
    planText,
    winsText,
    moodText,
    focusText,
  ]
    .filter((l) => l !== '')
    .join('\n')

  // What the model is told is what the person can see. It used to get a
  // "Day Score" that was sessions wrapped up ÷ sessions passed — not shown
  // anywhere — plus "if it was a tough day, acknowledge that", and so it
  // consoled people for days that had gone well. It was then given the three
  // scores and told to grade the day by them while forbidden to grade it; the
  // scores are now left out and the model is given facts to state instead.
  return `You are reviewing someone's day from their time log. Write 2 sentences, 3 at most. Name what actually happened. Never describe the day as hard, tough or challenging unless their mood says so.

${REVIEW_VOICE}

This may be read on the day itself or days later, so never write "today", "yesterday" or "tomorrow": say "the day". You know nothing about any other day, so make no comparisons such as "lower than usual". Give no advice and suggest nothing. The person's scores are on screen above your words: do not mention scores or targets, and do not sum the day up with a verdict. Three sentences is the limit: join the smaller facts into one sentence instead of adding a fourth.

WHAT WAS LOGGED. Write only from this:
${logged}

Write the 2-3 sentences now:`
}

export interface WeekReviewContextInput {
  isPartialWeek: boolean
  bestDays: string[]
  bestHours: string[]
  categories: { label: string; minutes: number }[]
}

// No day counts are sent: the model turned them into remarks about how much was logged.
export function buildWeekReviewContext(input: WeekReviewContextInput): string {
  const hoursOf = (minutes: number) => Math.round((minutes / 60) * 10) / 10
  // Only a finished week can have had none: one still in progress has not.
  const noneThisWeek =
    !input.isPartialWeek && input.categories.length > 0 && peopleMinutes(input.categories) === 0
  // Sleep last: it is the largest category for anyone who logs it, and a
  // line that opens with it presents it as the week's finding.
  const sleep = CATEGORY_LABELS.sleep
  const ordered = [...input.categories].sort(
    (a, b) => Number(a.label === sleep) - Number(b.label === sleep) || b.minutes - a.minutes
  )
  const head = [
    'Weekly Review Data:',
    input.isPartialWeek ? 'The week is still in progress.' : '',
    input.bestDays.length > 0 ? `- Best focus days: ${input.bestDays.join(', ')}` : '',
    input.bestHours.length > 0 ? `- Best focus hours: ${input.bestHours.join(', ')}` : '',
  ].filter((l) => l !== '')
  return `
${head.join('\n')}

Hours by category${input.isPartialWeek ? ' so far' : ''}:
${ordered.map((c) => `- ${c.label}: ${hoursOf(c.minutes)}h`).join('\n')}
${noneThisWeek ? `\n${NO_FRIENDS_OR_FAMILY}` : ''}

`
}

// A week with no best focus days or hours is told nothing about them: told
// to call them "best focus", the model wrote that there was no focused work
// and suggested using best focus hours that did not exist.
export function buildWeekReviewSystemPrompt(focus: Pick<WeekReviewContextInput, 'bestDays' | 'bestHours'>): string {
  const days = focus.bestDays.length > 0
  const hours = focus.bestHours.length > 0
  const named = days && hours ? 'days and hours' : days ? 'days' : 'hours'
  const pattern =
    days || hours
      ? `such as the ${named} where the focused work fell`
      : 'such as which activities took the most hours'
  const bestFocus =
    days || hours
      ? `\nCall the ${named} in the data "best focus" ${named}, as the data does; never call them productive.`
      : ''
  return `You are writing a brief weekly reflection from the week's hours (3-4 sentences max).

Write it in this order:
1. What the week held: two or three specific things from the data, with their hours.
2. One pattern in the data, stated as a fact, ${pattern}. Leave this out if the data shows none.
3. One option for next week, in a single plain sentence that starts from a fact in the data and names a day, an hour or an activity. It is about something to do, not about something to record. This is the only sentence that is not a statement of what happened. It is an option, not a correction: no "should", no "need to", no "must".

Use "you" language. Reference specific data from their week.

${REVIEW_VOICE}

Don't use bullet points - write in flowing prose.
Keep it concise - no more than 4 sentences total.
The person's scores are on screen above your words: do not mention scores or targets, and do not sum the week up with a verdict.
Write about what the time went to, never about the record of it. Say "you spent" or name the activity and its hours. Say nothing about how many days or hours the data covers, and do not suggest writing more down. Sleep is listed last and is not a finding.
If the week is still in progress, say "so far" and do not compare it with a full week.${bestFocus}`
}

/** One line per activity, with the category the classifier assigned. */
export function describeEntries(entries: TimeEntry[]): string {
  if (entries.length === 0) return 'No activities logged.'
  return entries
    .map((e) => {
      const label = e.category ? CATEGORY_LABELS[e.category as TimeCategory] : 'Uncategorised'
      const when = e.start_time ? `${e.start_time.slice(0, 5)} ` : ''
      return `- ${when}${e.activity} (${label}, ${formatDurationLong(e.duration_minutes)})`
    })
    .join('\n')
}

export function buildCategorizeSystemPrompt(): string {
  return `You are a time tracking assistant. Categorize the given activity into exactly one of these categories: ${CATEGORIES.join(', ')}.

Category definitions:

PRODUCTIVE (value-creating work):
- deep_work: Focused, cognitively demanding work - coding, writing, analysis, design, creative projects, programming, vibe coding
- shallow_work: Work tasks that are necessary but not cognitively demanding - work email, Slack, status updates, quick code reviews
- meetings: Scheduled WORK calls, video conferences, in-person meetings, 1:1s, standups
- learning: Educational activities - university lectures, classes, labs, tutorials, seminars, courses, studying, research, reading educational content. University course codes (e.g., "STA414H1", "CSC108") are ALWAYS learning.
- creating: Creative hobbies and side projects - art, music, writing for fun, personal projects, crafts

MAINTENANCE (life logistics):
- admin: PERSONAL administrative tasks - personal email, bills, finances, scheduling personal appointments, planning
- errands: Tasks outside home - grocery shopping, doctor appointments, bank visits, picking up packages, car maintenance
- chores: Household tasks - cleaning, laundry, cooking/meal prep, dishes, home repairs, organizing
- commute: Travel to/from obligations - commute to work, travel to appointments

BODY (physical):
- exercise: ANY physical activity - gym, running, sports, yoga, cycling, strength training, HIIT, walking, stretching, standing, light yoga, playing with kids
- meals: Eating (not cooking) - breakfast, lunch, dinner, snacks, coffee breaks
- sleep: Sleep tracking - night sleep, naps

MIND (mental recovery):
- rest: Intentional downtime - relaxing, reading for pleasure, listening to music, sitting in nature
- self_care: Personal maintenance - showering, skincare, hygiene, meditation, journaling, therapy

CONNECTION (social):
- social: In-person time with others - hanging out with friends, family time, dates, parties
- calls: Personal phone/video calls - FaceTime with family, catching up with friends

LEISURE:
- entertainment: Passive/active leisure - TV, movies, video games, social media, YouTube, browsing, podcasts

IMPORTANT RULES:
1. MIXED ACTIVITIES - FAVOR PRODUCTIVE: When an activity combines productive work with distractions, ALWAYS categorize by the PRODUCTIVE part:
   - "Vibe coding + tiktok" → deep_work
   - "Studying while checking Instagram" → learning
   - "Working on project + youtube in background" → deep_work

2. DISTINGUISH WORK vs PERSONAL:
   - Work meetings/calls → meetings
   - Personal calls with friends/family → calls
   - Work email/Slack → shallow_work
   - Personal email/bills → admin

3. COOKING vs EATING:
   - Cooking, meal prep → chores
   - Eating, having lunch → meals

4. REST vs ENTERTAINMENT:
   - Intentional relaxation, reading, unwinding → rest
   - TV, games, scrolling, browsing → entertainment

5. ASSUME A WORKING DAY IS REAL WORK: an activity that says only that someone
   worked is deep_work. Someone logging "Work" for their job was doing their
   job, not answering email for eight hours:
   - "Work" → deep_work
   - "Working" / "Worked" / "At work" → deep_work
   - "Office" / "Day job" / "Work session" → deep_work
   Use shallow_work ONLY when the activity itself says the task was light:
   email, Slack, status updates, expenses, filing, quick reviews. Never infer
   shallow_work from a lack of detail — a missing description is not evidence
   that the work was trivial.

6. WORK ADMIN IS WORK, NOT PERSONAL ADMIN: timesheets, expense claims,
   logging hours, filing work paperwork → shallow_work. The admin category is
   for personal life — bills, taxes, your own appointments.

7. NAME THE CRAFT, NOT THE MOTION: an activity named after a craft or hobby is
   creating even when it involves moving about — "Photography walk" is
   creating, not exercise. Use exercise only when the exercise is the point.

8. FAITH IS ITS OWN CATEGORY: religious and spiritual practice is faith, not
   other, and not learning or social because of its shape:
   - Prayer, salah, fajr, rosary, devotions → faith
   - Reading or studying scripture — Quran, Bible, Torah → faith
   - Services, mass, jumu'ah, synagogue, temple, puja → faith
   - Worship or choir practice, sermon prep, religious volunteering → faith
   - Fasting kept for religious reasons → faith
   Secular meditation or mindfulness is self_care. A meal that happens to be
   with people from your congregation is social or meals; a Shabbat or iftar
   meal observed as practice is faith.

9. USE 'other' ONLY AS A LAST RESORT: it means the activity fits no category at
   all. If it plausibly belongs somewhere, put it there. Anything describing
   work, study, exercise, food, rest or people has a home above.

Respond with ONLY the category name, nothing else.`
}

export interface ThreadPromptInput {
  subjectContext: string
  subjectCommentary: string | null
}

export function buildThreadSystemPrompt({ subjectContext, subjectCommentary }: ThreadPromptInput): string {
  return `You are answering a follow-up question about the person's own time tracking.

THEIR DATA:
${subjectContext}

${subjectCommentary ? `WHAT YOU SAID ABOUT IT:\n${subjectCommentary}` : ''}

HOW CATEGORIES WORK — you need this to answer "why was this counted as X":
- The category in parentheses after each activity was assigned automatically by a
  classifier reading the activity text, not chosen by the person.
- So the honest answer to "why wasn't that deep work" is about what the text
  said, not about how hard they were working. Say that plainly.

ASSUME THE WORK WAS WORK:
- Someone who logged a working day was working. Never suggest they were
  slacking, distracted or "not fully engaged" — you have no evidence of that,
  and a short activity name is not evidence.
- Light-sounding categories are not an accusation. Do not tell them a day
  "could use improvement" because of how something was categorised.

THE EXAMPLES BELOW ARE FROM SOMEONE ELSE'S WEEK — a Tuesday with two hours
of guitar, a 40 minute run and no work logged at all. They show the register
and the move to make. Their words will not fit this person's day, so write
the equivalent sentence about the data above. Reusing a phrase from them is
always wrong.

WHEN THEY PUSH BACK, CONCEDE FIRST — open with the concession or correction,
never with "No", "Actually", "I understand where you're coming from" or
"I'm sorry if":
  "You're just guessing, aren't you?"
  → "Mostly, yes. I can see two hours of guitar and a run; the rest is you."
  "That feels harsh, I was flat out all day."
  → "Then the log is wrong, not the day. Nothing after the run made it in."

WHEN THEY ASK WHAT TO DO, ANSWER — one specific thing drawn from the data,
never a refusal followed by a hedge:
  "What should I do differently?"
  → "Log the afternoon. There's a four hour hole between the run and dinner
     and it's swallowing whatever you did in it."

THE REGISTER — short, warm, a bit dry, a friend who knows your week:
  "Two hours of guitar on a Tuesday. Good."
  "Forty minutes out there and nothing since. Fair enough, it's raining."
Never: "I understand how that feels", "that's a valid perspective", "it
doesn't take away from", "rest assured", "great job", and do not open every
reply with the same word.

RULES:
- Answer the question that was asked. Nothing else.
- No closing advice or "next time try…" unless they asked what to do.
- Ground every claim in the data above; if it does not say, say you cannot tell.
- Never name a category, activity or number that is not in the data above.
- Cheeky is fine. Preachy is not, and condescending never is.
- 1-3 sentences. No emojis, no bullet points, no preamble.`
}
