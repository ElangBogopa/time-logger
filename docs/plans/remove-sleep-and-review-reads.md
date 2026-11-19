# Remove sleep and rebuild Body around movement; then reviews that lead with a decision

> **BUILT - do not run again.** Built on 2026-11-18 in the commit titled "Reviews lead with one read: Keep, Change or Nothing, by fixed rules (part 2 of remove-sleep-and-review-reads)". It stays as the record of what was asked.

## Goal

Part 1: sleep leaves the app by the owner's decision. Nothing offers it, asks
about it, scores it or expects it; saved sleep entries stay exactly as they
are and show as ordinary entries that feed no ring; every entry that crosses
midnight is split; and the Body ring is carried by movement, with rest and
self-care a small part that tops out at about 50.

Part 2: the day review and the weekly review each lead with one decision
(Keep, Change or Nothing) chosen by fixed rules from the log and only worded
by the model, with the evidence behind it and one button into the planner,
in place of a paragraph of totals.

## How this brief is built: two commits, in order

This brief is built in one `/do-build` run, as **two commits on `dev`**.

1. Build Part 1 completely. Run every Part 1 check under "Done when". When
   they pass, commit Part 1 to `dev` (stage its files by name; do **not**
   stage this brief and do **not** mark it BUILT yet). Do not push.
2. Only then start Part 2. **If Part 1 cannot be finished or a Part 1 check
   still fails, stop there: do not start Part 2, do not commit, and say what
   fails.**
3. Build Part 2 on top of the Part 1 commit. When the Part 2 checks pass,
   mark this brief BUILT (naming the Part 2 commit's title) and commit Part 2
   with the brief. If Part 2 cannot be finished, leave Part 1 committed,
   leave Part 2's work uncommitted, do not mark the brief BUILT, and say so.

The working tree has an uncommitted change to `docs/reviews/open.md`. Leave
it alone: never stage it, never edit it.

---

# PART 1: sleep out, Body around movement

## Files (Part 1)

### Types and categories

- `src/lib/types.ts`
  - Keep `'sleep'` in `TimeCategory` and in `CATEGORY_LABELS` (label stays
    `Sleep`): saved rows still carry it and the database enum is not touched.
    Change its comment to "No longer offered. Kept for rows saved before
    sleep was removed; feeds no ring."
  - Add `export const LOGGABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'sleep')`
    after `CATEGORIES`, with a comment: what a person or the categoriser may
    choose; `CATEGORIES` stays the full list, for reading saved rows.
  - `ENERGY_VIEW`: move `'sleep'` from `body.categories` to `ops.categories`
    (beside `'other'`), so a saved sleep entry is painted like any other
    uncounted entry and not in Body's colour. `meals` stays in `body`.
  - `CATEGORY_DEFINITIONS`: `sleep.definition` becomes "No longer offered.
    Entries saved as sleep before it was removed keep this category.", with
    empty `includes`/`excludes`. In `rest.excludes` and `self_care.excludes`
    delete the "(→ Sleep)" lines.

### The Body score

- `src/lib/metrics-calc.ts`
  - `BODY_CATS = ['exercise', 'movement', 'rest', 'self_care']`.
  - `UPKEEP_WEIGHTS = { self_care: 0.40, rest: 0.25 }` (meals and sleep
    removed: they count for nothing).
  - `UPKEEP_CEILING = 50`, `UPKEEP_TARGET = 30` (weighted minutes: about 45
    minutes of self-care and 45 of rest). `EXERCISE_TARGET` stays 45,
    `INTENSITY_MULTIPLIER`, `classifyIntensity`, `exerciseMinutes` unchanged.
    Leave `BODY_TARGET` as it is.
  - `calcBody`:
    ```ts
    const carePart = UPKEEP_CEILING * curveFraction(upkeepMinutes(dayEntries), UPKEEP_TARGET)
    const score = carePart + (100 - carePart) * curveFraction(exerciseMinutes(dayEntries), EXERCISE_TARGET)
    return Math.min(MAX_SCORE, Math.round(score))
    ```
    (Headroom runs to 100, not 99, so the movement target alone lands on 80
    exactly; the display is still clamped at 99.)
  - `calcBodyDetails`: same change in `categoryScores` (`(100 - upkeepContribution) * …`
    for exercise; care split between `rest` and `self_care` only). `breakdown`
    and `totalMinutes` now cover only `BODY_CATS`, so meals and sleep no
    longer appear in the Body detail sheet.
  - Rewrite the comments above `BODY_CATS`, `UPKEEP_CEILING`, `UPKEEP_WEIGHTS`,
    `UPKEEP_TARGET` and `calcBody` to say the new rule, with these worked
    examples (check them in the test, adjust a number by one if rounding
    differs):
    - 45 min gym, nothing else → 80
    - 45 min gym + 20 min shower → 83 or 84
    - 20 min run, nothing else → 76
    - 45 min walk, nothing else → 55
    - 60 min self-care + 2 h rest, no movement → 47
    - 4 h self-care, no movement → 50 at most
    - 8 h sleep + three meals, nothing else → 0
  - Do not touch Mind, Heart, `saturatingScore`, `countMetricsOnTarget`,
    `getStatusLabel`, `getNudge`.
- `src/app/api/metrics/route.ts`, `src/app/api/metrics/trend/route.ts`: no
  logic change needed (they read `BODY_CATS` / `calcBodyDetails`); fix only
  what the type checker asks for.
- `src/components/MetricDetailSheet.tsx`
  - `BODY_CATEGORY_INFO`: remove `meals` and `sleep`.
  - Empty state text: "Nothing for Body logged yet. Movement is what fills
    this ring."
  - The line shown when `exerciseScore === 0`: "Rest and self-care take Body
    to about 50 at most. Movement carries the rest."
- `src/components/OnboardingModal.tsx`: `SCORES` Body text becomes "Movement
  and exercise. About 45 minutes at a moderate effort is the target; rest
  and self-care add a little."
- `src/lib/library.ts`: entry `exercise-cognition`, `howWeUseIt` becomes "Why
  movement carries Body. Rest and self-care can take it to about 50 on their
  own; reaching the movement target scores 80, and twenty minutes of running
  beats a whole day of looking after yourself."

### The categoriser

- `src/lib/prompts.ts` → `buildCategorizeSystemPrompt`
  - List `LOGGABLE_CATEGORIES`, not `CATEGORIES`.
  - Delete the line "- sleep: Sleep tracking - night sleep, naps".
  - Add a numbered rule: "SLEEP IS NOT A CATEGORY: night sleep, "Sleep",
    "Slept 8 hours", "Went to bed" → other. A nap → rest." and make rule 9
    ("USE 'other' ONLY AS A LAST RESORT") say "apart from sleep".
- `src/app/api/categorize/route.ts`: validate against `LOGGABLE_CATEGORIES`
  in both places (`CATEGORIES.includes(answer)` → `LOGGABLE_CATEGORIES.includes(answer)`),
  so a model answer or a cached answer of `sleep` becomes `other`. Also map a
  cached `sleep` to `other` where the cache is read (both the single and the
  batch path).
- `scripts/eval/dataset.ts`: the `sleep` row expects `other` (accept `rest`
  for nothing but a nap). `scripts/eval/categorize.eval.ts`: validate with
  `LOGGABLE_CATEGORIES`.

### Saving entries across midnight

- `src/lib/overnight.ts`
  - `planOvernightSave(row, { dateIsWakeDay })`: remove the `isSleep`
    parameter and the branch that keeps one row. Every crossing row is split.
  - Keep `crossesMidnight`, `overnightPlacement`, `overnightDuration`,
    `onDayTimes`, `coveredOn`, `splitAtMidnight` as they are: rows saved
    before this change are still one piece and must still be placed.
  - Rewrite the file's header comment: every crossing entry is split on
    save; the placement helpers exist for one-piece rows saved earlier.
- `src/app/api/entries/route.ts` (POST)
  - `planOvernightSave(row)` for every row; delete `isSleep` and the comment
    about `overnight_sleep`. An `overnight_sleep` field in a request is
    ignored.
  - A new row whose `category` is `'sleep'` is stored as `'other'` (set this
    when building `row`): nothing can create a sleep entry any more, also
    not an old cached copy of the app.
- `src/app/api/entries/[id]/route.ts` (PUT)
  - Remove `isSleep`; `planOvernightSave(merged, { dateIsWakeDay })`. Keep
    `timesChange` and `dateIsWakeDay` exactly as they are: a save of the
    category, status or words alone still neither splits nor rejoins, so a
    saved one-piece sleep row is untouched unless the person changes its
    times, and then it is split like any other (its evening on the day
    before when it is dated its wake day).
  - If `updates.category === 'sleep'` and `stored.category !== 'sleep'`,
    write `'other'`. A row that is already sleep keeps its category.
- `src/lib/api.ts`: remove `overnight_sleep` from `CreateEntryParams` and
  from `updateEntry`'s parameter type.
- `src/components/QuickLogModal.tsx`
  - `overnightQuestion.kind` is only `'started-yesterday'`; remove
    `'tonight-sleep'`, `saveSleepNotTonight`, the `overnightSleep` parameter
    of `savePlanned`, and both sleep strings in the sheet ("Is this
    tonight's sleep?", "No, last night's").
  - `submitOvernight`: no category is fetched up front. On today with a
    start still ahead → ask "Did this start yesterday?". Otherwise, planning
    → `savePlanned(entryDate)`; logging → `resolveCategory()` then
    `saveConfirmed(entryDate, category)`.
  - `answerOvernight(yes)`: yes → `resolveCategory()` then
    `saveConfirmed(shiftDateString(entryDate, -1), category)`; no →
    `savePlanned(entryDate)`. The question state no longer carries a
    category. A plan is never categorised.
- `src/components/TimeEntryModal.tsx`: delete the block that categorises a
  planned crossing entry to set `overnight_sleep`, and stop spreading
  `overnightSleep` into `updateEntry`.
- `src/components/CategoryPicker.tsx`: `ORDERED` leaves out `'sleep'`. An old
  sleep entry opened for editing simply has no chip selected.

### Wake time: stated only

- `src/lib/habits.ts`: delete `usualWakeMinutes` and the `overnight` import
  it needed. In the `PLANNABLE` comment, "Sleep and meals happen anyway" →
  "Meals happen anyway".
- `src/hooks/useWakeTime.ts`: `useWakeTime()` takes no argument. `WakeSource`
  is `'set' | 'unknown'`; return `{ wakeMinutes, source, setWake }`.
  Rewrite the comment: the wake time is what the person has said, kept on
  the device; with none, the windows are the reference day.
- `src/hooks/useMyWindows.ts`, `src/app/calendar/page.tsx`: call
  `useWakeTime()` with no argument.
- `src/components/DayWindowsCard.tsx`: remove the "From your log: you
  usually wake around …" line and `learnedMinutes`; the ghost button beside
  "Change" always reads "Clear". Drop the `history` prop if nothing else in
  the component uses it, and update `src/app/page.tsx` accordingly.

### Words a person reads

- `src/app/calendar/page.tsx` (about line 1140): "Counting only what is on
  this page. Sleep, meals and anything unplanned add to it." → "Counting
  only what is on this page. Anything unplanned adds to it."
- `src/app/guide/page.tsx`
  - `EVENING_BLOCKS` last row: `activity: 'Wind down'`, `reason: 'No screens, dim lights.'`
  - "Based on a 16-hour waking day (8 hours sleep)" → "Based on a 16-hour waking day".
  - "The evidence for these cycles in waking hours is thinner than it is
    for sleep, so treat it as a starting point." → "The evidence for these
    cycles in waking hours is thin, so treat it as a starting point."
- `src/lib/quotes.ts`: delete the two quotes attributed to "Sleep
  Foundation" and "Sleep Research".
- `src/lib/prompts.ts` → `buildWeekReviewContext` and
  `buildWeekReviewSystemPrompt`: remove every special case for sleep (the
  "sleep last" sort, "Most hours apart from sleep" → "Most hours", "Sleep is
  listed last and is not a finding."), and leave out of `categories` any
  entry whose label is `CATEGORY_LABELS.sleep` so a week holding old sleep
  rows tells the model nothing about them. (Part 2 replaces these builders;
  Part 1 only has to leave them free of sleep.)
- `src/app/api/weekly-review/route.ts`: `topCategory` skips `sleep` as now
  but the insight reads "Most time: …" instead of "Most waking time: …".
  Raise `COACH_PROMPT_VERSION` to 11.
- `src/lib/commentary-cache.ts`: raise `PROMPT_VERSION` to 7.
- `scripts/eval/review-voice.eval.ts`: remove every `Sleep` hour from the
  scenarios, remove or rename the `sleep-only` and `sleep-heavy` scenarios
  (make them rest-only / rest-heavy), and remove the `sleep_was_the_largest`
  and `sleep_hours` kinds from `RECORD_KINDS` / `RECORD_BREAKS` and from the
  calibration lines. `scripts/eval/coach-voice.eval.ts`: drop the `sleep`
  entry from its scenarios.
- Comments: update the ones that state the old rule (sleep kept as one row,
  `overnight_sleep`, wake time from the log). A comment that uses "a night's
  sleep 23:00–07:00" as the example of a one-piece row saved earlier may
  stay, reworded to say it is an older row.

### CLAUDE.md (Part 1)

Rewrite these parts; keep everything else.

- "Categories": the `sleep` line's comment becomes "No longer offered; kept
  for rows saved before it was removed, feeds no ring". Under the code
  block add: "Nineteen are offered (`LOGGABLE_CATEGORIES`). Sleep was
  removed from the app: nothing offers it, the categoriser never returns it
  (typed sleep becomes Other), and no screen, reminder, review, planner or
  prompt mentions or expects it. Saved sleep entries are never deleted or
  rewritten; they show on the timeline as ordinary entries."
- "AI API Calls": delete the "One exception, approved by the owner: a
  planned entry whose times cross midnight is categorised once at save…"
  bullet.
- Replace the whole "Entries across midnight" section with:

  ```
  ### Entries across midnight
  - An entry whose end is earlier than its start crosses midnight (an end of
    `00:00` or `24:00` ends exactly at midnight and does not). Every such
    entry is split at midnight into two ordinary entries, one on each day,
    and nothing links them afterwards. There is no one-row exception.
  - Rows saved before sleep was removed may still be one piece (an overnight
    sleep, `end_time` earlier than `start_time`). They are left as they are.
    Such a row belongs to the day that holds more of it, and a tie goes to
    the wake-up day: 23:00–07:00 dated Tuesday is Monday 23:00 to Tuesday
    07:00. Its whole `duration_minutes` counts on its own date.
  - Anything that places an entry in a day — a session, an hour, a gap, the
    timeline, a sort — uses `onDayTimes` from `lib/overnight.ts`, never the
    raw times. The part of an older one-piece row that spills into the
    neighbouring day is `coveredOn` (`useOvernightSpill` on a screen):
    display only, never summed.
  - The rule runs when a save changes the times (`planOvernightSave`, in
    `POST /api/entries` and `PUT /api/entries/[id]`). A save of the category,
    status or words alone neither splits nor rejoins, and nothing reaches
    back to rewrite older rows. An older one-piece row whose times the
    person changes is split like any other.
  - The add sheet asks one question, only on today: "Did this start
    yesterday?" for a crossing entry whose start is still ahead.
  - The server never calls the model to save an entry, and a plan is never
    categorised.
  ```
- "Database Schema" note: "`end_time` may be earlier than `start_time` only
  on rows saved before every crossing entry was split (see "Entries across
  midnight"). An end at midnight is stored as `24:00`."
- File structure line for `overnight.ts`: "Entries across midnight: the
  split, and placement of older one-piece rows".
- Replace Design Principle 6 with:

  ```
  6. **Body is movement**: movement and exercise carry the ring, counted in
     moderate-equivalent minutes — vigorous double, light half, as the WHO
     guidelines count them, with the intensity read from the activity text
     by `classifyIntensity`. 45 of them is the target and scores 80. Rest
     and self-care are a small part on a curve of their own that approaches
     50 and never passes it (`UPKEEP_CEILING` is where you move the line),
     and movement closes the gap from there:
     `body = care + (100 − care) × curve(movement)`, shown up to 99. So a
     flawless day of rest and self-care scores about 47, and the movement
     target alone scores 80. Meals and sleep count for nothing in Body;
     meals stay loggable.
  ```
- Principle 11: delete "when you get up," from the list of what the planner
  reads from the log, and change "Nothing is proposed before half an hour
  after you usually wake" to "Nothing is proposed before half an hour after
  the wake time you have stated (6am when you have stated none)".
- Principle 12: "a time they state (`useWakeTime`, kept on the device) or
  that the log shows" → "a time they state (`useWakeTime`, kept on the
  device), never one read from the log; with none stated the windows are
  the reference day".

### Tests (Part 1) — update, do not weaken

Run `npm test` and fix what the change breaks; the ones known to need work:

- `src/lib/__tests__/body-metric.test.ts`, `saturating-score.test.ts`,
  `src/__tests__/day-score.test.ts`, `src/lib/__tests__/coach-facts.test.ts`:
  rewrite to the new rule. `body-metric.test.ts` must assert each worked
  example above, and add:
  - "a day of only rest and self-care never passes 50" (try several loads
    up to 12 h of each);
  - "the movement target alone scores exactly 80";
  - "meals and sleep add nothing to Body" (a day with and without them
    scores the same);
  - "old days re-score without error": rows as saved before the change —
    `{ category: 'sleep', duration_minutes: 480 }` beside meals, exercise
    and a row with an unknown category string — go through `calcBody`,
    `calcBodyDetails`, `calcFocus`, `calcSocial` and `countMetricsOnTarget`
    without throwing and with a finite 0–99 result.
- `src/__tests__/api/entries-overnight.test.ts`, `overnight.test.ts`,
  `quicklog-overnight.test.tsx`, `overnight-ui.test.tsx`,
  `crossing-event-confirm.test.tsx`, `summary-popup-overnight.test.tsx`:
  every test that expected a sleep saved as one row now expects two pieces.
  Keep the tests that place an already-stored one-piece row (`onDayTimes`,
  `coveredOn`, gaps, reminders, calendar match). Add to
  `entries-overnight.test.ts`:
  - POST "Sleep" 23:00–07:00 with category `sleep` → two rows, both stored
    with category `other`;
  - POST with `overnight_sleep: true` and no category → still two rows;
  - PUT changing only the words or the category of a stored one-piece sleep
    row → one update, times and duration untouched, no insert;
  - PUT changing the times of a stored one-piece sleep row dated its wake
    day → split, evening piece dated the day before.
- `src/__tests__/quicklog-overnight.test.tsx`: add "never asks about
  tonight's sleep" (type "Sleep" 23:00–07:00 on today after 6pm: the text
  "Is this tonight's sleep?" is not in the document) and "does not
  categorise a planned crossing entry" (`/api/categorize` not called).
- `src/__tests__/api/categorize.test.ts`: a model answer of `sleep` returns
  `other`, single and batch; the system prompt does not contain "sleep:" as
  a category line.
- `src/__tests__/category-picker.test.tsx`: one option fewer than
  `CATEGORY_LABELS`, and no "Sleep" chip.
- `src/__tests__/aggregated-categories.test.ts`: sleep is in `ops`.
- `src/__tests__/habits.test.ts`: delete the `usualWakeMinutes` block.
  `src/__tests__/day-windows-card.test.tsx`, `plan-personal.test.tsx`,
  `review-window-alignment.test.tsx`: a wake time comes only from
  `localStorage['wake-time']`; add to the windows card test "a log full of
  sleep entries does not move the windows and no 'From your log' line is
  shown".
- `src/lib/__tests__/review-week-context.test.ts`,
  `review-people-line.test.ts`, `review-voice-check.test.ts`,
  `src/__tests__/api/weekly-review-cache.test.ts`: remove the sleep
  expectations; add "a week holding old sleep rows tells the model nothing
  about sleep" (the context string does not match `/sleep/i`).

## Steps (Part 1)

1. `git branch --show-current` → must be `dev`.
2. Types and `LOGGABLE_CATEGORIES`; categoriser prompt and route.
3. Body score and its tests; detail sheet, onboarding, library text.
4. `planOvernightSave`, the two entries routes, `api.ts`, `QuickLogModal`,
   `TimeEntryModal`, `CategoryPicker`; their tests.
5. Wake time from the log removed; windows card.
6. Words on the guide, plan page and quotes; review prompt builders and the
   weekly insight freed of sleep; versions raised; eval scenarios.
7. CLAUDE.md.
8. Part 1 checks (below). Commit Part 1.

---

# PART 2: reviews that lead with a decision

Each review screen becomes, top to bottom: the three rings, each with a line
comparing it with the person's last four weeks; **one read**; the evidence
behind it; one button into the planner.

The app chooses the read and its facts by the fixed rules below. The model
receives only those fact sentences and words them. If the model fails, the
facts themselves are shown.

## Definitions used by every rule

Write these as small pure helpers in the new `src/lib/review-read.ts`.

- **Row**: `{ date, activity, category, start_time, end_time, duration_minutes }`
  of a confirmed entry with a category.
- **Logged day**: a date with at least one row.
- **Focus rows**: category `deep_work`, `learning` or `creating`.
  **Focus minutes** of a day: the sum of their `duration_minutes`.
  **Longest focus block**: the day's focus row with a `start_time` and the
  largest `duration_minutes`.
- **Movement minutes**: `exerciseMinutes(rows)` from `metrics-calc`
  (moderate-equivalent). **Heart minutes**: `heartMinutes(rows)`.
- **Where a row sits in its day**: always `onDayTimes(row)`, never the raw
  times.
- **Focus windows**: the person's windows (`windowsForWake(wakeMinutes)`)
  whose `categories` include `deep_work`. **Movement windows**: those that
  include `exercise`. **In-window share** of a day's focus:
  `windowAlignment(dayRows, windows)`, the `focus` fact.
- **History**: the 28 days before the reviewed day (day review) or before
  the week's Monday (weekly review).
- **Usual** of a ring: the median of that ring's score (`calcBody`,
  `calcFocus`, `calcSocial`) over the history's logged days. It exists only
  when the history has at least `MIN_HISTORY_DAYS = 7` logged days.
- Times in facts are written with `formatTimeDisplay`, lengths with
  `formatDuration`, days as "Mon 16 Nov". Fact sentences never contain
  "today", "yesterday" or "tomorrow".

## The ring lines

`ringComparisons(scores, history)` → for each of body, focus, social either
`{ usual, relation: 'above' | 'below' | 'about' }` or, when there is no
usual, `null` for all three plus `loggedDays`.

- `above` when score − usual ≥ 8, `below` when ≤ −8, otherwise `about`.
- Day review compares the day's score; weekly review compares the week's
  average (the `averages` it already shows).
- Text under each ring: "Above your usual 55", "Below your usual 55",
  "About your usual". These are fixed strings, not model output.
- With too little history, no line under any ring and one line under the
  row: "Too little history to compare yet: 4 of the last 28 days have
  anything logged." (the real count).
- `MetricRingRow` (`src/components/MetricRings.tsx`) gains an optional
  `notes?: Partial<Record<MetricKey, string>>`: each is drawn centred under
  its ring's label, `text-xs text-muted-foreground`, at most about 6.5rem
  wide, and is added to the row's `sr-only` sentence. `caption` stays and
  carries the too-little-history line. The "… logged" caption is removed
  from the day review and the "N of three on target" caption from the
  weekly review.

## The read

```ts
export type ReadKind = 'keep' | 'change' | 'nothing'
export interface ReadSlot { title: string; startTime: string /* HH:MM */; durationMinutes: number }
export interface ReviewRead {
  scope: 'day' | 'week'
  kind: ReadKind
  rule: string                 // the ids below
  facts: string[]              // whole sentences; the only thing the model is given
  evidence: { label: string; value: string }[]
  slot: ReadSlot | null        // keep: when it happened; change: the hour proposed
  timing: boolean              // true → "In your windows" is shown as evidence
}
```

`dayRead({ date, rows, history, windows })` and
`weekRead({ days, history, windows, isPartialWeek, weekHeartMinutes })`
return one `ReviewRead`. Order is always: the first Change that fires, else
the best Keep, else Nothing. `plainReadText(read)` joins the facts with
spaces; it is what the screen shows if the model gives nothing.

`A_FEW_DAYS = 3`. A Change can never come from fewer than three days.

### Day rules

A **run** is the count of consecutive logged days ending at the reviewed
day for which a condition holds, looking back at most 14 calendar days.
Days with nothing logged are skipped: they neither count nor break the run.
A day Change fires only when `3 ≤ run ≤ 7` (past a week it is the weekly
review's subject, not a daily repeat).

| id | Fires when | Slot | Facts (in order) | Evidence | timing |
|---|---|---|---|---|---|
| `change-no-movement` | Condition per day: movement minutes = 0. Also: movement minutes > 0 on at least 3 days of the history (so it is this person's own practice that lapsed). | title: the exercise/movement activity logged on the most history days (tie → most recent); start: `usualFor(title, 'exercise', history)?.startMinutes`, else the start of the last movement window; length: that usual's `durationMinutes`, else 30. | "No movement was logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov." / "In the four weeks before, movement was logged on 9 days, usually around 6:00 PM." (leave out the "usually" clause when there is no usual hour) / "One option: Run at 6:00 PM." | one row per day of the run ("Mon 16 Nov" → "No movement"), then "Last four weeks" → "Movement on 9 days" | false |
| `change-focus-outside-window` | Condition per day: at least 60 focus minutes with a start time, and in-window share under 50%. | title: the reviewed day's longest focus block's activity; start: the start of the first focus window; length: that block's length rounded to 15, between 30 and 120. | "On 3 days in a row, less than half of the focused work fell inside the focus windows (9:00 AM–12:00 PM and 2:00 PM–4:00 PM)." / "On this day it was 30m of 2h." / "One option: Essay draft at 9:00 AM." | one row per day of the run ("Mon 16 Nov" → "30m of 2h inside") | true |

Check them in that order; the first that fires is the read.

Keeps look only at the reviewed day (plus history for what is usual):

| id | Fires when | Slot | Facts | Evidence | timing |
|---|---|---|---|---|---|
| `keep-long-focus` | The longest focus block is at least 60 min, and either the history has 5 or more days with a focus block and this one is at least 1.25 × the median of those days' longest blocks, or the history has fewer and this one is at least 90 min. | the block: its activity, its on-day start, its length rounded to 15 (at most 180) | "The longest focused block was 2h 10m on "Essay draft", starting at 9:15 AM." / when there is a median: "The usual longest block over the last four weeks is 1h 20m." / when it started inside a focus window: "It started inside the focus window (9:00 AM–12:00 PM)." | "Longest focused block" → "2h 10m, from 9:15 AM"; "Usual longest block" → "1h 20m over 11 days" | true |
| `keep-movement-target` | Movement minutes ≥ 45, and either the history has no usual (under 7 logged days) or the median of movement minutes over the history's logged days is under 45. | the day's movement row worth the most moderate-equivalent minutes that has a start time | "60 moderate-equivalent minutes of movement, most of it "Run" at 6:00 PM, which reaches the movement target of 45." / with history: "The usual over the last four weeks is 15 minutes a day." / when that row started inside a movement window: "It fell inside the Physical peak window (5:00 PM–7:00 PM)." | "Movement" → "60 of 45 minutes"; "Usual" → "15 minutes a day" | true only when the window fact is present |
| `keep-people-time` | Heart minutes ≥ 60, and either no usual or the median of heart minutes over the history's logged days is under 60. | the longest row that `countsTowardHeart` with a start time | "2h with friends or family, the longest "Dinner with family" at 7:00 PM." / with history: "The usual over the last four weeks is 20 minutes a day." | "With friends or family" → "2h"; "Usual" → "20 minutes a day" | false |

When more than one Keep fires, take the one whose ring score is furthest
above its usual; with no usual, or a tie, the table's order.

Otherwise `nothing-ordinary`: facts "An ordinary day: nothing in it stands
apart from the last four weeks." (with under 7 logged history days:
"An ordinary day. There is too little history yet to say what is usual.")
then "Most of the logged time went to Deep Work (3h) and Meals (1h)." (the
one or two largest categories by minutes, by `CATEGORY_LABELS`; never
Sleep). No slot, no evidence, `timing: false`. **The day review never says
there was no time with friends or family**, in any kind.

### Week rules

`days` are the week's days up to the last finished one, as
`/api/weekly-review` already decides (`effectiveEndDate`).

| id | Fires when | Slot | Facts | Evidence | timing |
|---|---|---|---|---|---|
| `week-change-movement-few-days` | The week has at least 5 logged days, movement minutes > 0 on at most 1 of them, and the history has movement on at least 3 days. | as `change-no-movement` | "Movement was logged on 1 of the 6 days." / "In the four weeks before, it was logged on 9 days, usually around 6:00 PM." / "One option: Run at 6:00 PM." | "This week" → "Movement on 1 of 6 days"; "Four weeks before" → "Movement on 9 days" | false |
| `week-change-focus-outside-window` | At least 3 days of the week each have 60 or more timed focus minutes with an in-window share under 50%. | title: the activity of the longest focus block among those days; start: the first focus window's start; length: that block rounded to 15, 30–120 | "On 3 days (Mon, Wed and Thu), less than half of the focused work fell inside the focus windows (…)." / "Over the week it was 2h of 9h." / "One option: Essay draft at 9:00 AM." | one row per such day | true |
| `week-keep-focus-start` | Mind (`calcFocus`) reached 80 on at least 2 days, at least one other logged day did not, and on the days it did the first focus block began within 60 minutes of one another. | title: the most common activity among those first blocks (tie → the longest); start: their median start rounded to 15; length: their median length rounded to 15, 30–180 | "Mind reached its target on Tue and Thu." / "On both days focused work began around 9:00 AM." / "On the other 4 days it did not reach it." | one row per day on target ("Tue" → "from 9:00 AM, 3h 30m focused") | true |
| `week-keep-movement-days` | The movement target (45) was reached on at least 3 days, and that is more than the history's count of such days ÷ 4. | when those days' largest movement rows start within 120 minutes of one another: the most common activity, median start rounded to 15, median length; otherwise no slot | "The movement target was reached on 4 days: Mon, Wed, Fri and Sat." / "In the four weeks before, it was reached on 6 days in all." / with a slot: "Those sessions began around 6:00 PM." | one row per such day | false |

Order: the two Changes in table order, then the Keeps (furthest above usual
first, as for the day), else `week-nothing-ordinary`: "An ordinary week:
its shape matches the four before it." (or the too-little-history wording)
then "Body reached its target on 2 days, Mind on 3 and Heart on 1.".

For every kind:
- A week still in progress puts "The week is still in progress." first and
  is never told what it lacks.
- A **finished** week whose `weekHeartMinutes` is 0 gets
  `NO_FRIENDS_OR_FAMILY` ("No time with friends or family was logged this
  week.") as its last fact. The prompt requires it in the line, once, in
  those words; `plainReadText` carries it too.

### The weekly "what your log shows" finding

New `src/lib/log-findings.ts`: `logFinding({ rows, windows })`, over the 90
days ending at the week's last finished day, returns at most one
`{ id, sentence }` or `null`. It is written by the app from a template; the
model never sees or words it. The fixed list:

| id | With / without | Compared | Small (skip) |
|---|---|---|---|
| `training-early-late` | Days whose largest movement row (at least 20 real minutes, with a start time) started before 12:00 / at or after 12:00 | median focus minutes that day | under 30 min apart |
| `focus-start-in-window` | Days whose longest focus block started inside a focus window / outside | median length of that block | under 15 min apart |
| `people-then-next-day` | Logged days with at least 30 heart minutes / with none, where the following day is also a logged day | median focus minutes on the following day | under 30 min apart |

- A finding needs at least 5 days with and 5 without (`MIN_FINDING_DAYS = 5`).
- Among those that qualify, show the one with the largest relative
  difference (`|a − b| / max(a, b)`); never more than one.
- The sentence states both day counts and both figures and nothing else,
  e.g. "On the 7 days you trained before noon, your focused work came to a
  median of 3h 10m. On the 9 days you trained later, 2h 20m." /
  "On the 8 days your longest focused block started inside your focus
  window, its median length was 1h 45m. On the 6 days it started outside,
  1h 05m." / "On the 6 days after a day with friends or family, your
  focused work came to a median of 2h 40m. After the 12 days without,
  3h 20m."
- Never a cause: the templates contain no "because", "so", "leads to",
  "causes", "makes", "helps", "thanks to", "when you … you". Never a score,
  a percentage or a ring.

## The button

One primary `Button` (default variant, full width, 44px) ends each screen;
`PlanNextCard` and the weekly "Plan tomorrow" button are removed.

`resolveReadAction({ read, reviewDate | weekStart, today, nowMinutes, busyToday, busyTomorrow, plannedTitles })`
(pure, in `review-read.ts`) returns `{ label, targetDate, slot | null }`:

- Target day, day review: today when the reviewed day is before today, it
  is before 18:00 and (if there is a slot) the slot's start is still ahead;
  otherwise tomorrow. Weekly review: tomorrow.
- A slot is offered only when the read has one **and** the review is recent
  (day: the reviewed day is today or yesterday; week: this week or last).
- "Free" means no calendar event and no planned task with a time overlaps
  `[start, start + length)` on the target day. Keep: offer the same slot
  only if it is free. Change: if the named hour is not free, move forward
  in 30-minute steps for up to 3 hours to the first free start; if there is
  none, offer no slot.
- If a task on the target day already matches the title (`activityMatch`
  ≥ 1 either way), offer no slot.
- Label with a slot: `Plan "Essay draft" at 9:00 AM tomorrow` (or
  `… today`). Without: "Plan tomorrow" / "Plan the rest of today", going to
  `/calendar?date=<target>` (or `/calendar` for today) as `PlanNextCard`
  did.
- Tapping a slot button: disable it, `POST /api/plans { date, title }`,
  then `PATCH /api/plans { id, committed_start, committed_end }`, then
  `router.push('/calendar?date=<target>')`. On failure show
  `toast.error("Couldn't add that to the plan. Try again.")` (sonner) and
  stay. Nothing is written until the person taps.

New `src/hooks/useReadAction.ts` gathers the inputs: `useCalendar().getEventsForDate`
for today and tomorrow, `GET /api/plans?date=` for both (cached in
`sessionStorage` per date, shown from cache then refreshed), the clock.

## Files (Part 2)

- **New `src/lib/review-read.ts`**: everything above except the finding.
  Pure: no React, no fetch, no model.
- **New `src/lib/log-findings.ts`**: the finding.
- **New `src/hooks/useLogRange.ts`**: `useLogRange(from, to, enabled)` →
  `{ rows, loaded }` via `fetchEntries({ dateFrom, dateTo, status: 'confirmed' })`,
  reduced to Row fields, cached in `sessionStorage` under
  `log-range:<from>:<to>`; shown from the cache at once and refreshed behind
  it (the pattern in `useWeekEntries`). Never another range's rows while a
  new one loads.
- **New `src/hooks/useReadAction.ts`**: as above.
- `src/lib/prompts.ts`
  - Remove `buildDayReviewPrompt`, `DayReviewPromptInput`,
    `buildWeekReviewContext`, `WeekReviewContextInput`,
    `buildWeekReviewSystemPrompt`, `peopleMinutes` and `PEOPLE_LABELS`.
    Keep `REVIEW_BANNED_WORDS`, `REVIEW_VOICE`, `NO_FRIENDS_OR_FAMILY`,
    `DAY_REVIEW_PARAMS`, `WEEK_REVIEW_PARAMS` (lower `max_tokens` to 120 and
    160). `REVIEW_DATA_LABELS` keeps only labels a builder still writes
    before a colon (expected: none — facts are sentences).
  - Add `buildReadSystemPrompt(scope, kind)` and
    `describeRead(read: Pick<ReviewRead, 'facts'>)` (the facts, one per
    line, under "THE FACTS. Write only from these:"). The system prompt
    includes `REVIEW_VOICE` and says, in the builder's own tuned words:
    - Every number, hour, day and activity name must come from the facts.
      Add no fact, no reason and no cause of your own.
    - `keep`: one or two sentences. Say what worked and the reason the
      facts give. You may end by saying the same hour is there to use
      again; an option, never "should", "need to" or "must".
    - `change`: one or two sentences (three for a week). Say how many days
      the facts name, then give the "One option" fact as an option, with
      its hour. Never a correction.
    - `nothing`: one sentence, two at most. Say plainly that it was an
      ordinary day (or week). No advice, no suggestion, nothing to do.
    - Day: never "today", "yesterday" or "tomorrow".
    - Week: if the facts contain the sentence about friends or family,
      include it once, in its own words. If they say the week is in
      progress, say "so far".
    - Do not mention scores. Do not remark on how much was logged.
  - Update the comment above `REVIEW_BANNED_WORDS` for the new names.
- `src/app/api/day-commentary/route.ts`: body is `{ read: { kind, facts } }`.
  Validate with a `sanitiseRead` exported from `review-read.ts`: `kind` one
  of the three, `facts` an array of 1–6 strings, each cut to 240
  characters; anything else → 400. Messages: system
  `buildReadSystemPrompt('day', kind)`, user `describeRead`. Session check,
  rate limit and the `{ commentary }` response stay.
- `src/lib/commentary-cache.ts`: `PROMPT_VERSION` → 8. Replace
  `commentaryFingerprint`/`CommentaryInputs` with
  `readFingerprint(read)` = `stableHash(JSON.stringify([PROMPT_VERSION, read.rule, read.facts]))`.
- `src/app/api/day-review/backfill/route.ts`: stop calling
  `/api/day-commentary` and save `commentary: null` (the read is worked out
  from the log when the day is opened). Nothing else in it changes.
- `src/app/api/day-review/route.ts`, `src/app/api/day-summary/route.ts`:
  unchanged.
- `src/components/review/DayReviewContent.tsx`
  - Rows: `useLogRange(shiftDateString(date, -28), date)`. The day's rows
    and the history both come from it, so a saved day (which carries no
    entries) reads the same as a live one. `useMyWindows` still supplies
    `windows`; drop its `history` use here.
  - Rings: `calcBody`/`calcFocus`/`calcSocial` of the day's rows; delete the
    `/api/metrics/trend` fetch. `notes`/`caption` from `ringComparisons`.
  - Read: `dayRead(...)` once the range is loaded; a two-line pulse
    skeleton until then (the one used for commentary now). Words: look up
    `readCachedCommentary(date, readFingerprint(read))`, else POST
    `/api/day-commentary`, else `plainReadText(read)`. Never ask the model
    for a day with nothing logged. The saved `commentary` of an already
    finalised review is no longer shown; `saveReview` (the
    `needs_finalization` path) stores the read's words in `commentary`, all
    other fields as now.
  - The read card: the existing bordered card with the `Sparkles` icon, the
    words, and `CommentaryThread subjectType="day"` ("Ask about this")
    under them.
  - Evidence, under an `eyebrow` heading "Behind this": `read.evidence` as
    one card with `divide-y` rows (label left, value right); then
    `WindowAlignmentCard` only when `read.timing`; nothing at all when
    there is no evidence and no timing. Then "Your plan"
    (`PlanVsActualCard`) as now when the day had plans.
  - Remove: the "Longest focus session" card, `PlanNextCard`, the old
    commentary request body, the `Clock`/`CalendarClock`/`ChevronRight`
    imports left unused. The empty-day state keeps its text and ends with
    the plain button.
  - The button from `useReadAction`.
- `src/app/api/weekly-review/route.ts`
  - Body gains `wakeMinutes?: number | null` (an integer 1–1439, else
    null); `windows = windowsForWake(wakeMinutes)`.
  - One history query replaces the previous-week query: confirmed rows from
    `shiftDateString(weekStart, -91)` to the day before `weekStart`
    (`prevEntries` is the last 7 days of it).
  - Compute `comparisons = ringComparisons(averages, last 28 days)`,
    `read = weekRead(...)`, `finding = logFinding(...)` (rows: the history
    plus this week's days).
  - The model call: system `buildReadSystemPrompt('week', read.kind)`, user
    `describeRead(read)`. `coachFingerprint = stableHash(COACH_PROMPT_VERSION + read.rule + facts)`;
    the `knownCoachFingerprint` skip stays as it is. `COACH_PROMPT_VERSION`
    → 12.
  - Response adds `read`, `comparisons`, `finding`. Stop building
    `insights` and `highlights` (return empty arrays or drop the fields and
    their client types); `bestDays`/`bestHours` and the code that only fed
    them go too.
- `src/components/review/WeeklyReviewContent.tsx`
  - Send `wakeMinutes` from `useMyWindows`; the client cache key becomes
    `weekly-review:<weekStart>:<wakeMinutes ?? 'ref'>`.
  - Rings with `notes`/`caption` from `comparisons`; delete the
    `/api/metrics/trend` fallback fetch and `weekLabel`.
  - Read card: `coachSummary ?? plainReadText(read)`, with
    `CommentaryThread subjectType="week" subjectKey={weekStart}`.
  - "Behind this": `read.evidence`, then `WindowAlignmentCard`
    (heading "In your windows this week", no `lead`) only when
    `read.timing`.
  - "What your log shows" (`eyebrow`), only when `finding` is not null: the
    sentence in one card, and under it in `text-xs text-muted-foreground`:
    "From your last three months. A pattern in the log, not a cause."
  - The button from `useReadAction` (shown for every week; a slot only for
    this week or last).
  - Remove: Highlights grid, Insights list, the old summary block and its
    "Plan tomorrow" button, the unused `RATING_*` constants and target
    interfaces if nothing reads them. The Year in Pixels row stays last.
  - The "Not enough data yet" state is unchanged.
- `src/lib/review-voice-check.ts`: `checkReviewLine` options gain
  `readKind?: ReadKind` and `facts?: string[]`.
  - Day lines: `nothing` keeps the `advice` rule; `keep` and `change` use
    the `correction` rule instead. Day limit 2 sentences; week limit 4.
  - New rule `nothing-advice` for both scopes when `readKind === 'nothing'`
    (the `ADVICE` words plus "could", "option", "plan").
  - New rule `ungrounded`, when `facts` is given: every clock time and
    every number in the line must appear in the facts (compare digits;
    allow a number written as a word for one to ten, and "both" for 2).
  - New rule `cause` for both scopes: "because", "thanks to", "leads to",
    "led to", "caused", "as a result".
  - `absence-unsaid` and the other people rules keep working from
    `peopleMinutes`/`isPartialWeek` as now.
- `scripts/eval/review-voice.eval.ts`: scenarios are now `ReviewRead`s built
  by calling `dayRead` / `weekRead` on invented logs (so the eval measures
  what production sends): for the day at least one per rule id plus a
  nothing day with thin history; for the week one per rule id, a finished
  week with no friends or family for a keep and for a nothing, and a week
  in progress. Prompts from `buildReadSystemPrompt` + `describeRead`.
  Checker called with `readKind` and `facts`. Judge rules: `grounded`,
  `no_evaluation`, `no_consolation`, and `no_advice` only for nothing
  reads; drop the record-kind judge and its calibration if no rule needs
  it. The test now fails when any line breaches `ungrounded`,
  `nothing-advice`, `cause`, `empty` or `absence-unsaid`, and when more
  than 5% of lines have any other checker breach. Tune the prompt, not the
  thresholds, until it passes at `EVAL_SAMPLES=3`.
- `docs/voice-lines/after.md`: the report of the passing run.
- `CLAUDE.md` (Part 2)
  - "AI API Calls", the eval bullet: name `buildReadSystemPrompt` and
    `describeRead` in place of "`REVIEW_VOICE` and the builders beside it".
  - The friends-or-family bullet: keep, and say the sentence now travels as
    the last fact of the week's read.
  - "What the app is for": "both reviews end by pointing at the planner" →
    "both reviews lead with one read and end on one button into the
    planner".
  - Add Design Principle 13:

    ```
    13. **A review leads with a decision**: each review is the three rings
        with a line against the person's last four weeks, one read, the
        evidence behind it and one button into the planner. The read is
        Keep (something worked, why, and the same slot if it is free),
        Change (only with three or more days behind it, never one off day;
        it names an hour and its button puts that into the plan) or
        Nothing (an ordinary day, said plainly, no advice). The app picks
        the kind and the facts by fixed rules (`lib/review-read.ts`); the
        model is given only those fact sentences and words them, and if it
        fails the facts are shown as they are. The weekly read is about
        the week's shape, and may show one "what your log shows" finding
        from a fixed list (`lib/log-findings.ts`): five days with and five
        without in the last three months, both counts stated, never worded
        as a cause, never a score. No totals paragraph, no judging labels,
        no fourth number — principle 7.
    ```

### Tests (Part 2)

- **New `src/lib/__tests__/review-read.test.ts`**
  - ring lines: above / below / about at the ±8 line; under 7 logged days →
    no usual and the real count;
  - "a Change never comes from one day": the condition on the reviewed day
    only → not a change; on two days → not a change; on three → change; on
    eight → not a change (day rules); an unlogged day in the middle neither
    counts nor breaks the run;
  - `change-no-movement` does not fire for someone with no movement in
    their history;
  - each Keep fires on its example and not on a day that is merely usual;
    two Keeps → the one furthest above usual;
  - an ordinary day → `nothing-ordinary`, no slot, no evidence, and no fact
    containing "could", "should", "option" or "plan";
  - no day read ever states an absence of friends or family; a finished
    week with none ends its facts with `NO_FRIENDS_OR_FAMILY`; a week in
    progress does not;
  - each week rule on its example; a week Change from three days of the
    week itself;
  - no fact of any read contains "sleep", "today", "yesterday", "tomorrow"
    or a score;
  - every number in `evidence` and `slot` is derivable from the rows given
    (spot-check each rule);
  - `resolveReadAction`: keep with a free slot → slot label; keep with the
    slot taken → plain label; change with the hour taken → next free half
    hour; nothing → plain label; a reviewed day three days back → no slot;
    title already planned → no slot; today vs tomorrow by the clock;
  - `sanitiseRead` rejects a wrong kind, too many facts, non-strings.
- **New `src/lib/__tests__/log-findings.test.ts`**: 5 with / 4 without →
  null; 5 / 5 with a large difference → the sentence, containing both day
  counts; a small difference → null; two qualify → one returned, the larger
  relative difference; no sentence matches
  `/because|so that|leads? to|causes?|makes|helps|thanks to|%|score/i`.
- `src/__tests__/day-review.test.tsx`, `day-review-commentary-loop.test.tsx`,
  `day-review-embedded-chrome.test.tsx`, `review-window-alignment.test.tsx`:
  rewrite to the new screen (mock `/api/entries` for the range and
  `useCalendar`). Must cover: the read's words are shown and "Ask about
  this" is under them; a model failure shows the plain facts; the model is
  asked once per unchanged day and again when the facts change; nothing
  logged → no model call; no "Longest focus session" text; no "… logged"
  caption; "In your windows" appears for a timing read and not for
  `nothing-ordinary`; exactly one button that goes to the planner; a slot
  button posts the plan then navigates; the ring lines and the
  too-little-history line.
- `src/__tests__/api/day-commentary.test.ts`: new body; malformed read →
  400; the prompt contains the facts and `REVIEW_VOICE` and nothing else
  from the request.
- `src/__tests__/api/weekly-review-cache.test.ts`: the fingerprint skip
  still works; the response carries `read`, `comparisons`, `finding`; a
  finished week with no friends or family sends the sentence to the model;
  no `insights`/`highlights` content.
- `src/__tests__/api/ai-route-guards.test.ts`: still passes for
  `/api/day-commentary` and `/api/weekly-review`.
- `src/lib/__tests__/review-voice-check.test.ts`: the three new rules and
  the day `keep`/`change` vs `nothing` advice split.
- Delete `review-week-context.test.ts` and `review-people-line.test.ts`
  only after their still-true expectations (no sleep, the friends sentence,
  no label and colon) are covered by `review-read.test.ts`.
  `commentary-cache.test.ts` → `readFingerprint`.
- Weekly screen: a test file (extend `review-window-alignment.test.tsx` or
  add `weekly-review-read.test.tsx`) covering the read card, "What your log
  shows" shown with a finding and absent without, one planner button, no
  Highlights or Insights.

## Steps (Part 2)

1. `review-read.ts` and its test, rule by rule.
2. `log-findings.ts` and its test.
3. Prompts, `day-commentary` route, `commentary-cache`, voice checker.
4. `MetricRingRow` notes; `useLogRange`; `useReadAction`.
5. `DayReviewContent`; its tests.
6. `weekly-review` route; `WeeklyReviewContent`; their tests.
7. Eval scenarios; run `EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice`;
   tune `buildReadSystemPrompt` until it passes.
8. CLAUDE.md; Part 2 checks; mark the brief BUILT; commit Part 2.

---

## Rules that apply

- Branches: work on `dev`, commit there, never push, never touch `main`.
- "Common Pitfalls → AI API Calls": only confirmed entries are categorised
  (Part 1 removes the one exception); run `npm run eval:voice` and raise
  `PROMPT_VERSION` and `COACH_PROMPT_VERSION` when what the reviews are
  told changes (both parts); the friends-or-family rule (the day review
  never says there was none; a finished week is told so in a sentence).
- "Entries across midnight" and Design Principle 6: changed by the owner's
  decision; rewritten in Part 1 as given above.
- Timezone handling: dates only through `getLocalDateString`,
  `shiftDateString`, `getWeekStartForDate`; never `toISOString()` for a
  local date. `review-read.ts` and `log-findings.ts` work on date strings.
- Principle 2 (palette) and 3 (minimal UI): no new colours; lists are one
  card with `divide-y`; one primary button per decision; no icon in a
  tinted circle.
- Principle 5 (type scale): `eyebrow` headings, nothing under 12px,
  `text-muted-foreground` at full strength.
- Principle 7 (one scoring system): the ring lines reuse `calcBody`,
  `calcFocus`, `calcSocial`; a finding and the evidence are facts, never a
  score, a percentage ring or a fourth number.
- Principle 8 (no loading flash): `useLogRange` and the plans lookup cache
  in `sessionStorage` and refresh behind the cache.
- Principle 9 (time-aware labels): no judging labels in the reviews; ring
  lines say only above / below / about the person's own usual.
- Principles 11 and 12: the planner's habit rules stay; wake time is only
  what the person states; anything reasoning about "the right hour" takes
  the shifted windows.
- "Who is signed in": routes use `getAppSession()`; nothing new imports
  `next-auth`. Every route that calls OpenAI checks the session first and
  rate-limits by user id.
- No new table and no new column, so `ACCOUNT_TABLES` is unchanged.

## Do not

- Do not delete, rewrite, re-date, re-categorise or split any saved row by
  migration, script or background code. No migration in this change; the
  `sleep` value stays in the database enum.
- Do not add a journal, a mood rating, health-device data, a fourth ring, a
  new score or percentage, or any open-ended pattern search. The finding
  list is the three ids above and nothing else.
- Do not let the model choose the read's kind, facts, hour or finding, and
  do not send it totals, scores or category tables.
- Do not make a Change from fewer than three days, and never tell a day it
  had no time with friends or family.
- Do not touch `main`, do not push, do not stage or edit
  `docs/reviews/open.md`, do not edit `docs/BUSINESS-CONTEXT.md` (it
  changes only at a merge) or the other docs under `docs/` apart from
  `docs/voice-lines/after.md` and this brief.
- Do not change Mind or Heart scoring, the hero's status labels
  (`getStatusLabel`), reminders' rules, the planner's suggester, the
  session popup or the coach voice.
- Do not start Part 2 before Part 1 is committed.

## Done when

Part 1 (before its commit):

- `npx tsc --noEmit` clean; `npm test` green; `npm run test:tz` green;
  `npm run lint` at 0 errors and no more than the current 48 warnings;
  `npm run build` succeeds.
- `EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice`
  runs to the end and no line mentions sleep.
- `grep -rni "sleep" src --include='*.ts' --include='*.tsx' | grep -v __tests__`
  shows only: the `sleep` member, label, definition and `ops` listing in
  `types.ts`; the categoriser's "sleep is not a category" rule; the guard
  that stores `other`; the `slept` stem in `plan-adherence.ts`; and
  comments about one-piece rows saved earlier. List what remains in the
  reply.
- The tests named under "Tests (Part 1)" exist and pass, including: only
  rest and self-care ≤ 50; movement target alone = 80; old rows re-score.
- In the app: the category chips have no Sleep; typing "Sleep" 23:00–07:00
  on Today saves two "Other" pieces and asks nothing about tonight; an
  older saved sleep entry still shows on its day, labelled Sleep, in the
  neutral colour; the Body sheet lists no meals or sleep; "Your windows"
  shows no "From your log".

Part 2 (before its commit):

- The same five commands, same lint ceiling.
- `EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice`
  passes its new assertions; `PROMPT_VERSION` is 8 and
  `COACH_PROMPT_VERSION` is 12.
- The tests named under "Tests (Part 2)" exist and pass, including "a
  Change never comes from one day".
- `grep -rn "Longest focus session\|PlanNextCard\|buildDayReviewPrompt\|buildWeekReviewContext" src scripts`
  finds nothing.
- In the app, paging the day review over several days: the top line is a
  Keep with its reason, a Change that names its days and an hour, or a
  plain ordinary day; under each ring is its line (or the one
  too-little-history line); "Ask about this" sits on the read; one button,
  and with a free slot it names the task and hour and the task is on the
  plan after tapping it. The weekly tab has the same shape, at most one
  "What your log shows" sentence, and a finished week with no friends or
  family says so in a sentence. Nothing anywhere mentions sleep.

## Not decided

nothing

## Who should build and review this

- *Build with* **Opus**. The rules are pinned here, but the work is two
  dependent parts across about fifty files, with a prompt that has to be
  tuned against a real model until the eval passes; that tuning and the
  judgment on each old test are what a cheaper model gets wrong.
- *Review with* **Opus**. No sign-in, deletion, export or database shape is
  touched; what needs a careful read is that saved rows are never rewritten
  and that a Change cannot come from one day, both of which the tests pin.
- *Effort*: high, because it is two builds in one run and the second
  depends on the first being right.
