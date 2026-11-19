# Session sheet and the coach voice

> **BUILT - do not run again.** Built on 2026-11-18 in the commit titled "Session sheet and coach voice: coach facts and prompts, plain session sheet that scrolls clear of the tab bar". It stays as the record of what was asked.

## Goal

When a person finishes a session ("Done with afternoon"), the sheet shows the
total and category chips that add up to it, no "Session MVP", no "Ask about
this" chat, and one comment from a sharp coach on their side: true to the
log, the Body / Mind / Heart targets, the plan and the hours that suit each
thing, and pointing at what is still possible. The whole sheet scrolls clear
of the tab bar. New per-entry remarks speak in the same voice. The day and
week reviews do not change.

Decided while planning (the request left these open):

1. **The facts come from the client, the wording from the server.** The
   session page already posts the session's entries to
   `/api/period-commentary`; it will also post the day's confirmed entries,
   the day's plans, the wake time it already knows and the current minute.
   The server turns those into facts with a pure function and writes the
   prompt. Nothing new is stored.
2. **Scores are never quoted as numbers.** The comment says a ring "reached
   its target" or how many minutes are left to it — never "Mind 82".
3. **Looking ahead:** a morning or afternoon session finished on today looks
   at later today (the sessions still to come, plans not yet due, windows
   still open). An evening session finished on today looks at tomorrow
   (tomorrow's first windows). A session finished for an earlier day does
   not look ahead at all and ends on what the session showed.
4. **The per-entry remark** says only what this entry added (a ring it
   brought to target, minutes toward one, how it sits in the day) and never
   what the day lacks. It does not use the windows (the entry sheets do not
   know the wake time, and principle 12 forbids the unshifted day).
5. **Entry remarks get the whole day.** `TimeEntryModal` sent only the two
   entries either side, so "this took Mind to its target" would have been
   computed from a fragment. It now sends the full day; the server only
   sends summaries to the model, so the prompt does not grow.
6. **Saved session chats are left where they are.** Rows in
   `commentary_replies` with `subject_type = 'session'` are not deleted or
   migrated. They stay in `ACCOUNT_TABLES`, so they are still exported and
   still deleted with the account; they are simply no longer shown or
   reachable from the API. The day review keeps its "Ask about this".
7. **The share card's fallback** "Great {period} session!" becomes
   "{Period} wrapped up.", the same text the sheet already shows.
8. **A voice eval for the coach**, `npm run eval:coach`, mirrors
   `eval:voice`. Nothing about the review eval changes.

## Files

- `src/lib/prompts.ts` — add, below the existing review code and without
  touching anything above it: `COACH_BANNED_WORDS`, `COACH_VOICE`,
  `SESSION_COMMENT_PARAMS`, `ENTRY_REMARK_PARAMS`,
  `buildSessionCommentarySystemPrompt`, `describeSessionFacts`,
  `buildEntryRemarkSystemPrompt`, `describeEntryFacts`. `REVIEW_VOICE`,
  `REVIEW_BANNED_WORDS`, `buildDayReviewPrompt`, the week builders and
  `buildThreadSystemPrompt` stay byte-for-byte the same.
- `src/lib/coach-facts.ts` (new) — pure functions `buildSessionFacts` and
  `buildEntryFacts`, and their types.
- `src/lib/coach-voice-check.ts` (new) — `checkCoachLine`, the machine
  checks for tests and the eval only (not run in the routes, same as
  `review-voice-check.ts`).
- `src/app/api/period-commentary/route.ts` — new request shape, validation,
  facts, new prompt. Delete `buildPeriodContext` and the tone guidance.
- `src/app/api/commentary/route.ts` — new prompt from `buildEntryFacts`.
  Delete `getCategoryTone`, `getDurationCategory`, `detectMixedActivity`,
  `buildContext` and all the tone/duration/mixed instruction blocks.
- `src/app/log/[period]/page.tsx` — `handleDone` posts the extra fields;
  stop passing `date` to `PeriodSummaryPopup`.
- `src/components/PeriodSummaryPopup.tsx` — remove the thread, the MVP and
  the top-3 cut; fix the scroll; drop the `date` prop.
- `src/components/CommentaryThread.tsx` — drop `'session'` from
  `CommentarySubject`, drop the `tone` prop and its dark styling (only the
  session sheet used them).
- `src/app/api/commentary/thread/route.ts` — drop `'session'` from
  `SUBJECT_TYPES`, `SESSION_KEY`, and the session branch of
  `loadSubjectContext`; drop imports that become unused
  (`getEntriesForPeriod`, `TimePeriod`).
- `src/components/TimeEntryModal.tsx` — the two `/api/commentary` calls send
  the full day (`dayEntries`), not `nearbyEntries`.
- `scripts/eval/coach-voice.eval.ts` (new) and `package.json` (new script
  `eval:coach`).
- Tests: `src/lib/__tests__/coach-facts.test.ts`,
  `src/lib/__tests__/coach-voice-check.test.ts`,
  `src/lib/__tests__/coach-prompts.test.ts` (new);
  `src/__tests__/api/period-commentary.test.ts`,
  `src/__tests__/api/commentary-thread.test.ts`,
  `src/__tests__/summary-popup-overnight.test.tsx` (update);
  `src/__tests__/summary-popup-sheet.test.tsx` (new).

## Steps

### 1. Facts (`src/lib/coach-facts.ts`)

Types:

```ts
export interface CoachEntry {
  id: string
  activity: string
  category: TimeCategory | null
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  description?: string | null
}

export type RingKey = 'body' | 'focus' | 'social'
export interface RingFact {
  key: RingKey
  label: string            // METRIC_LABELS[key]: Body / Mind / Heart
  state: 'reached' | 'already' | 'open' | 'missed'
  // reached = below target before these entries, on target after
  // already = on target before them
  // open    = not on target, and there is still time today (later-today only)
  // missed  = not on target, and the day's sessions are over (tomorrow / none)
  done: number             // minutes so far toward the target (see below)
  target: number
  unit: string             // e.g. 'focused minutes', 'moderate-equivalent exercise minutes', 'minutes with friends or family'
}
```

Per ring, "on target" is `score >= METRIC_THRESHOLDS.green` using
`calcBody`, `calcFocus`, `calcSocial` from `lib/metrics-calc.ts` — the same
test `countMetricsOnTarget` uses. Map `CoachEntry` to the metrics `EntryRow`
as `{ category: e.category ?? 'other', duration_minutes, date: '', activity }`.
`done`/`target`/`unit`: Mind → `calcFocusDetails(...).weightedMinutes` of
`FOCUS_TARGET`; Body → `exerciseMinutes(...)` of `EXERCISE_TARGET`; Heart →
`heartMinutes(...)` of `SOCIAL_TARGET`. Round `done`.

`buildSessionFacts(input)`:

```ts
interface SessionFactsInput {
  period: TimePeriod
  sessionEntries: CoachEntry[]
  dayEntries: CoachEntry[]   // confirmed entries of the session's date (may or may not include the session's)
  plans: PlanRow[]           // from lib/plan-adherence
  windows: DayWindow[]       // windowsForWake(wakeMinutes)
  nowMinutes: number | null  // minutes past midnight if the date is today, else null
}
```

Returns `SessionFacts`:

- `period`, `periodLabel` (`PERIOD_LABELS`), `totalMinutes`, `entryCount`.
- `categories`: `{ label, minutes }[]`, every category in the session
  (null → `other`), sorted by minutes descending.
- `activities`: up to 12 `{ activity, label, minutes, start, end }`, in
  start order (activity sliced to 80 characters).
- `ahead.kind`: `'none'` when `nowMinutes === null`; else `'tomorrow'` when
  `period === 'evening'`; else `'later-today'`.
- `rings`: all three, computed on `day = dayEntries ∪ sessionEntries`
  (dedupe by `id`, session copy wins) against `before = day` minus the
  session's ids. State as above; a not-on-target ring is `open` when
  `ahead.kind === 'later-today'`, else `missed`.
- `plansKept` / `plansNotDone`: run `comparePlanToActual({ plans, entries:
  day, nowMinutes })`; keep the comparisons whose `committedStart` hour is
  inside `PERIOD_TIME_RANGES[period]`; `kept` or `moved` → `plansKept`,
  `missed` → `plansNotDone`. Each `{ title (sliced to 80), start }`.
- `windowFacts`: `windowAlignment(sessionEntries, windows)` (lib/window-alignment).
- `ahead.nextSessions`: later-today → the period labels after this one
  (Morning → Afternoon, Evening; Afternoon → Evening); tomorrow →
  `['Morning']`; none → `[]`.
- `ahead.plans`: later-today only → comparisons with outcome `upcoming`,
  sorted by start, up to 3; otherwise `[]`.
- `ahead.windows`: later-today → windows with `endMinutes > nowMinutes`,
  sorted by `startMinutes`, up to 3, as `{ label, start, end }` (HH:MM);
  tomorrow → the first two windows by `startMinutes`; none → `[]`.

`buildEntryFacts({ entry, dayEntries })` returns: `activity`, `label`,
`minutes`, `start`, `end`, `description` (sliced to 200, or null),
`dayTotalMinutes` (day = dayEntries with this entry replacing its own id, or
appended), `sameCategoryToday` (count in day), and `rings`: only the rings
this entry feeds (Mind if `FOCUS_WEIGHTS[category]`, Body if
`exerciseMinutes([entry]) > 0`, Heart if `countsTowardHeart(entry)`), each
with state `reached` / `already` / `open` (no `missed` for an entry).

### 2. Voice and prompts (`src/lib/prompts.ts`)

Add, word for word (the builder may fix grammar, not meaning):

```ts
export const COACH_BANNED_WORDS = [
  'crushed', 'crushing', 'killing it', 'nailed', 'beast', 'legend',
  'amazing', 'incredible', 'awesome', 'fantastic', 'epic', 'superstar',
  'keep it up', "you've got this", 'proud of you', 'great job', 'well done',
  'journey', 'lazy', 'slacking', 'wasted', 'unproductive', 'procrastinating',
  'procrastination', 'distraction', 'come on', 'we both know', 'avoiding',
  'guilty',
] as const

export const COACH_VOICE = `VOICE: a sharp coach who is on this person's side. Warm, direct and specific. Wit is welcome when it is about the situation, never at the person's expense.
- Every claim must come from the facts given: what was logged, Body / Mind / Heart against their targets, the plan, and the hours that suit each kind of activity. If it is not in the facts, do not say it.
- Use the real activity names and the real minutes from the facts. Never quote a score as a number; say a ring reached its target, or how many minutes are left to it.
- Never tease, mock, or guess at motives. Never invent a flaw, a habit or a temptation. Take every activity as the person named it; leisure, rest and screens are time they chose.
- Never scold or correct: no "should", "should have", "need to", "must", "next time", "try to", no guilt.
- No hype and no filler. Never use these words or anything like them: ${COACH_BANNED_WORDS.join(', ')}.
- No emoji. At most one exclamation mark.`

export const SESSION_COMMENT_PARAMS = { model: 'gpt-4o-mini', max_tokens: 150, temperature: 0.7 } as const
export const ENTRY_REMARK_PARAMS = { model: 'gpt-4o-mini', max_tokens: 40, temperature: 0.7 } as const
```

`buildSessionCommentarySystemPrompt(aheadKind)` returns `COACH_VOICE` plus:

```
Write 2 or 3 sentences, under 60 words, about this person's session.
- Lead with the most real thing in the facts: a ring that reached its target in this session, a plan kept, time that landed in the hours that suit it. Pick one or two; do not list everything.
- If the session holds little — not much logged, no ring reached, a plan not done — say what was there plainly, with no verdict. Allow that rest may have been the point. Do not console or apologise.
- A plan not done is said once, flatly, or left out. Never as a failing.
- A ring marked "still open" has not been missed: there is time left today.
- <ending line, by aheadKind>
```

Ending lines: `later-today` → "End by pointing at one thing still possible later today, from the \"Still ahead\" facts only."; `tomorrow` → "End by pointing at one thing tomorrow makes possible, from the \"Still ahead\" facts only. Say nothing more about today's rings than the facts state."; `none` → "This session's day is over. Do not look ahead; end on what the session showed."

`describeSessionFacts(facts)` returns plain lines (one fact per line, no
JSON), in this order and shape:

```
Session: Afternoon. Logged: 3h 10m across 4 activities.
Activities: "Essay draft" (Deep Work) 14:00–16:00, 2h; ...
Time by kind: Deep Work 2h, Meals 40m, ...
Mind reached its target in this session (250 of 240 focused minutes).
Heart was already on target before this session.
Body is still open: 10 of 45 moderate-equivalent exercise minutes so far.      (open)
Body did not reach its target today: 10 of 45 ... .                            (missed)
Plan kept: "Run" (17:00).
Plan not done: "Call Mum" (15:00).
Hours that suit it: 1h 30m of 2h of focused work fell in the hours that suit it.
Still ahead later today: the Evening session; planned "Read" at 21:00; Time with people 18:00–21:00.   (later-today)
Still ahead tomorrow: the Morning session; Focus 08:00–11:00; ...             (tomorrow)
```

Leave a line out when it has nothing to say (no plans, no window facts).
For `none` write no "Still ahead" line. Durations via `formatDurationLong`.
The facts pass the ring state words only; the model is told "still open",
never "missed", for an `open` ring.

`buildEntryRemarkSystemPrompt()` returns `COACH_VOICE` plus:

```
Write ONE sentence, under 15 words, about this one activity.
- Say something true about it: what it added (a ring it brought to target, minutes toward one), when it happened, or how it sits in the day so far.
- Speak only about this entry and what it added. Never mention what the day lacks.
```

`describeEntryFacts(facts)` — lines: the activity, label, time and minutes;
the person's notes if any; "Logged today so far: …"; "This is the Nth
{label} entry today."; one line per ring ("With this, Mind reached its
target for today." / "Heart was already on target today." / "Toward Body:
30 of 45 moderate-equivalent exercise minutes today.").

Put a doc comment above `COACH_VOICE`: the session comment and the
per-entry remark share it; it is separate from `REVIEW_VOICE` on purpose;
check a wording change with `npm run eval:coach`. Session comments are not
cached and saved entry remarks are never rewritten, so no version number is
needed.

### 3. Routes

`/api/period-commentary` (keep the session check and rate limit first,
as now). Body:

```ts
{ period, date, entries, dayEntries, plans, wakeMinutes, nowMinutes }
```

Validate: `period` is a `TimePeriod`; `date` matches `YYYY-MM-DD`; `entries`
non-empty array (else 400, as now), at most 60 kept; `dayEntries` array
(missing → `[]`), at most 120; `plans` array (missing → `[]`), at most 40,
each needing a string `title` (sliced to 80) and `committed_start`/
`committed_end` strings or null, `completed` boolean; `wakeMinutes` and
`nowMinutes` integers in 0–1439 or null (anything else → null). Entries
need a string `activity` (sliced to 80), a finite `duration_minutes`
between 0 and 1440, a category in `CATEGORIES` or null, `start_time` /
`end_time` strings or null; drop entries that fail. Then
`buildSessionFacts({ ..., windows: windowsForWake(wakeMinutes) })`, one
model call with `SESSION_COMMENT_PARAMS`, system =
`buildSessionCommentarySystemPrompt(facts.ahead.kind)`, user =
`describeSessionFacts(facts)`. Response unchanged: `{ commentary }`.

`/api/commentary`: same guards. Filter `dayEntries` to those not
`status === 'pending'`, cap at 120, then `buildEntryFacts`, one call with
`ENTRY_REMARK_PARAMS`, `buildEntryRemarkSystemPrompt()` and
`describeEntryFacts(facts)`. Keep the existing error handling. Response
unchanged.

`/api/commentary/thread`: remove `'session'` as described in Files.

### 4. Clients

`src/app/log/[period]/page.tsx`, in `handleDone`, before the
`/api/period-commentary` call:

- fetch `/api/plans?date=${selectedDate}` (inside its own try/catch; on
  failure use `[]`) — fresh, because a plan may have just been ticked in
  Next up;
- `wakeMinutes` from `useMyWindows()` (`src/hooks/useMyWindows.ts`), called
  once at the top of the page;
- `nowMinutes`: `getUserCurrentHour() * 60 + new Date().getMinutes()` when
  `selectedDate === getUserToday()`, else `null`;
- `dayEntries`: `visibleEntries.filter(e => e.status !== 'pending')`.

Post `{ period, date: selectedDate, entries: periodEntries, dayEntries,
plans, wakeMinutes, nowMinutes }`. Remove the `date={selectedDate}` prop
from `<PeriodSummaryPopup>`.

`src/components/TimeEntryModal.tsx`: both calls send `dayEntries` (the full
fetched day) instead of `nearbyEntries`; delete the `nearbyEntries` lines
and their comments. `GhostEntryModal` already sends the full day.

### 5. The sheet (`src/components/PeriodSummaryPopup.tsx`)

- Remove the `CommentaryThread` import and element, and the `date` prop
  (and its doc comment) from the props.
- Remove `sessionMVP`, its JSX block and the `Zap` import. Rename the
  comment "Time summary with MVP" to "Time summary".
- Remove `.slice(0, 3)` from `sortedCategories`, so every category in the
  session gets a chip and the chips add up to the total. `handleShare`
  keeps its own `.slice(0, 3)` for the card.
- Share fallback: `` `${PERIOD_LABELS[period]} wrapped up.` ``.
- Scrolling. Two causes: the sheet and `BottomTabBar` are both `z-50`
  inside `.app-frame`, and the tab bar comes later in the DOM, so it paints
  over the sheet's last part; and the heights are in `vh`. Change:
  - outer wrapper: `fixed inset-0 z-[60] flex items-end justify-center`
    (add `data-testid="period-summary-sheet"` to it);
  - modal div: add `flex max-h-[calc(100%-2.5rem)] flex-col`;
  - the bordered frame div: drop `max-h-[88vh]`, add `flex min-h-0 flex-col`;
  - the scrolling div: drop `max-h-[calc(88vh-2px)]`, add
    `min-h-0 flex-1 overscroll-contain` (keep `overflow-y-auto` and the
    safe-area bottom padding).
  Leave the title "{Period} Complete", the header, the comparison line,
  the commentary block (minus the thread), the tasks block and the actions
  as they are.

`src/components/CommentaryThread.tsx`: remove `'session'` from
`CommentarySubject`, the `tone` prop, `const dark` and every class branch
on it (keep the `card` classes); fix the file's header comment, which
mentions the session summary.

### 6. Checker (`src/lib/coach-voice-check.ts`)

`checkCoachLine(text, { kind: 'session' | 'entry', aheadKind?: 'later-today' | 'tomorrow' | 'none' }): VoiceBreach[]`
(reuse the `VoiceBreach` type from `review-voice-check.ts`). Rules:
`banned-word` (COACH_BANNED_WORDS, whole word, case-insensitive), `scold`
(should, should have, need to, must, next time, try to), `score-number`
(`/100`, "out of 100", a number directly after Body/Mind/Heart), `emoji`,
`exclamation` (more than one `!`), `too-long` (entry: over 20 words or more
than one sentence; session: over 70 words or more than 3 sentences),
`looks-ahead` (aheadKind `none` and the line contains "later today",
"tonight" or "tomorrow"), `empty`. Header comment: tests and the eval only,
not run in the routes.

### 7. Eval (`scripts/eval/coach-voice.eval.ts`, `package.json`)

Mirror `scripts/eval/review-voice.eval.ts` (same `loadEnv`, concurrency,
samples, judge-with-a-second-model and report shape). Script:
`"eval:coach": "jest --testMatch='**/scripts/eval/coach-voice.eval.ts' --testTimeout=1800000 --runInBand"`.
Scenarios built with `buildSessionFacts` / `buildEntryFacts` and sent with
the production prompt builders and params: a morning where Mind reaches
target; a quiet afternoon of a nap and TV with a plan still upcoming; an
afternoon with a plan not done; an evening with dinner with family where
Heart reaches target (ahead tomorrow); a thin evening with nothing reached
(ahead tomorrow); a session for an earlier day (ahead none); entries: 2h
of TV, a 45-minute gym session that takes Body to target (on a day with
sleep and meals logged), a nap, a third
hour of meetings. Judge rules: `grounded` (every claim is in the facts),
`on-side` (no jab, tease or invented flaw), `no-scold`, `forward` (session
with ahead ≠ none ends looking ahead), `not-premature` (nothing judged that
still has time). Default report path `docs/voice-lines/coach.md`.

### 8. Tests

- `coach-facts.test.ts`: Mind `reached` when the day had 60 focused minutes
  before and the session adds 200; Heart `already`; a not-on-target ring is
  `open` for a 13:00 morning finish and `missed` for an evening one;
  `ahead.kind` for (today, afternoon) / (today, evening) / (past date);
  a plan at 15:00 logged as kept lands in `plansKept` of the afternoon and
  not the morning; an upcoming 21:00 plan appears in `ahead.plans` at
  `nowMinutes = 18*60`; `categories` sums to `totalMinutes`;
  `buildEntryFacts` reports Body `reached` for a 45-minute gym entry on a
  day that already holds 8h sleep and two meals (45 minutes of gym alone
  scores 79, under the target), and lists no Heart ring for a solo run.
- `coach-prompts.test.ts`: the session system prompt contains
  `COACH_VOICE` and the matching ending line for each `aheadKind`;
  `describeSessionFacts` writes "still open" for an `open` ring and no
  "Still ahead" line for `none`; neither the session nor entry prompt
  contains a score number; `REVIEW_VOICE` is not in either.
- `coach-voice-check.test.ts`: flags "Third TikTok session today. Come
  on.", "You should have gone to the gym.", "Crushed it!!", "Mind 82 today",
  a session line with "tomorrow" when `aheadKind: 'none'`; passes "Two
  hours on the essay took Mind to its target, and the evening is still open
  for a walk."
- `period-commentary.test.ts`: update the body to the new shape; capture
  the `create` arguments and assert one call, that the user message
  contains the session's activity name, and that a malformed `plans` /
  `wakeMinutes` is ignored rather than rejected.
- `commentary-thread.test.ts`: change the `'session key without a period'`
  case to `'session type, which is no longer offered'` with
  `subject_type=session&subject_key=2026-11-02:morning`, still 400.
- `summary-popup-overnight.test.tsx`: drop the `date` prop.
- `summary-popup-sheet.test.tsx` (new): render `PeriodSummaryPopup` with
  four entries in four categories (e.g. 60 Deep Work, 30 Meals, 20 Calls,
  10 Chores) — four chips, the total "2h 0m"; no text "Session MVP"; no
  "Ask about this"; `getByTestId('period-summary-sheet')` has class
  `z-[60]`. Use the same mocks and fake timers as the overnight test.

## Rules that apply

- AI calls: commentary only for confirmed entries (the routes filter
  pending ones out of the day); one model call per session comment and
  per entry remark; every OpenAI route checks the session first and
  rate-limits by user ID.
- Principle 7, one scoring system: rings are judged with `calcBody` /
  `calcFocus` / `calcSocial` and `METRIC_THRESHOLDS.green`, no new formula.
- Principle 9, time-aware labels: a ring with time left is "still open".
- Principle 12: windows come from `windowsForWake`, never `IDEAL_DAY`.
- Heart counts as `countsTowardHeart` / `heartMinutes` count it.
- Placing entries in a session stays `getEntriesForPeriod` (uses
  `onDayTimes`).
- Design principles 2 and 3: the sheet keeps its existing classes; nothing
  new is coloured; it stays a bottom sheet.
- Principle 8: the extra plans fetch happens on tapping Done, not on
  mount; no new cached screen state.
- Dates: `getUserToday()` for "is this today", never `toISOString()`.
- `ACCOUNT_TABLES` is not changed: no table is added or dropped.

## Do not

- Do not change `REVIEW_VOICE`, `REVIEW_BANNED_WORDS`, `REVIEW_DATA_LABELS`,
  `buildDayReviewPrompt`, `buildWeekReviewContext`,
  `buildWeekReviewSystemPrompt`, `buildThreadSystemPrompt`,
  `review-voice-check.ts`, `review-voice.eval.ts`, `/api/day-commentary`,
  `/api/weekly-review`, `PROMPT_VERSION` or `COACH_PROMPT_VERSION`.
- Do not touch the day review's "Ask about this" (`DayReviewContent.tsx`).
- Do not rewrite or regenerate `commentary` on existing entries; no backfill.
- Do not delete or migrate any `commentary_replies` rows; no migration.
- Do not change the title "{Period} Complete".
- Do not run `checkCoachLine` in the routes.
- Do not touch the round button at the right edge in the owner's
  screenshots — it is Vercel's preview toolbar, not the app.
- Do not edit `CLAUDE.md`.

## Done when

- `npx tsc --noEmit` clean.
- `npm test` passes, with the new and updated tests above.
- `npm run test:tz` passes.
- `npm run lint` stays at 0 errors and no more than 49 warnings.
- `npm run build` succeeds.
- `git diff main...dev -- src/lib/prompts.ts` shows only additions below
  the existing review code (nothing removed or changed above it).
- If `.env.local` has `OPENAI_API_KEY`: `EVAL_SAMPLES=1 npm run eval:coach`
  runs and writes `docs/voice-lines/coach.md`; commit that file. If no key,
  say so in the build report.
- In the app (preview on a phone): finish an afternoon session — the total
  and chips that add up to it, no MVP block, no "Ask about this", a comment
  that names real activities and points at the evening; scroll to the
  bottom and the Continue button sits fully above the tab bar. Finish an
  evening session — the comment looks to tomorrow. Log one entry — a
  one-sentence remark in the same voice. Open the day review — its line and
  its "Ask about this" behave as before.

## Not decided

Nothing.

## Who should build and review this

- **Build with Sonnet.** The voice text, the facts and every file are
  spelled out; what is left is careful typing across about a dozen files.
- **Review with Opus.** It changes what the model is told about a person
  and what the sheet shows; nothing touches sign-in, data shape or deletion.
- **Effort: medium.**
