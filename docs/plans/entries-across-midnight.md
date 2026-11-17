# Entries across midnight

> **BUILT - do not run again.** Built on 2026-11-16 in the commit
> titled "Entries across midnight: sleep stays one row, anything else splits at midnight". It stays as the record of what
> was asked.

## Goal

An entry whose times cross midnight saves. Anything that is not sleep is
split at midnight into two ordinary entries, one on each day. Sleep stays one
entry on the date it was logged on, the app works out which side of midnight
it sits on, and the neighbouring day shows the part that spills into it as
covered, without counting it.

## What the research found (and the rule chosen)

How the main sleep trackers give a night to a day:

- **Fitbit**: the wake-up day. `dateOfSleep` is "the date the sleep log
  ended". https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/
- **Garmin**: the wake-up day. A sleep that starts one day and ends the next
  is filed under the next day (`calendarDate`). Secondary sources only;
  Garmin's own page would not load.
  https://help.labfront.com/garmin-sleep-data-defined ,
  https://sahha.ai/blog/which-day-does-sleep-belong-to/
- **Oura**: a fixed 6 PM cut-off. "Oura records one main sleep cycle ...
  between 6 PM and 6 PM the next day. If that sleep period ends after 6 PM,
  it's counted toward the next day." An ordinary night lands on the wake-up
  day. https://support.ouraring.com/hc/en-us/articles/360025445574
- **Whoop**: no calendar rule; the main sleep "starts a Cycle", so the night
  you wake from opens the day that follows.
  https://developer.whoop.com/docs/developing/user-data/sleep
- **Apple Health**: undocumented; people report the Health chart running
  6 PM to 6 PM, so a night shows on the wake-up day.
  https://discussions.apple.com/thread/255850700

All five put an ordinary night (11 PM to 7 AM) on the day you wake up. None
uses "whichever day holds more". For a 6 PM to 1 AM sleep all of them would
say the next day; the owner has fixed that case the other way, and it wins.

**The rule:** a sleep that crosses midnight belongs to the day that holds
more of it; a tie goes to the wake-up day. It needs nothing stored beyond
the entry's own date and times:

- minutes before midnight = `1440 − start`; minutes after = `end`.
- after ≥ before → **wake-day**: the entry's date is the day it ended; it
  began the evening before. 11 PM–7 AM on Tuesday is Monday 11 PM to
  Tuesday 7 AM. This is what every tracker does for an ordinary night.
- before > after → **start-day**: the entry's date is the day it began; it
  ends the next morning. 6 PM–1 AM on Monday is Monday 6 PM to Tuesday 1 AM.

## Definitions used below

- **Crosses midnight**: start and end both set, end is earlier than start,
  and end is not midnight. An end of `00:00` or `24:00` is "ends exactly at
  midnight": it does not cross, is never split and never asks a question.
- **One-piece overnight entry**: a stored row that crosses midnight. After
  this change that is sleep, a planned sleep (category null), or a sleep
  whose category was later changed. Every reader treats any such row by the
  rule above, whatever its category.
- Times come back from the database as `HH:MM:SS`; `timeToMinutes` already
  copes. Everything this change writes is `HH:MM`.

## Files

### New

1. `supabase/migrations/20261116b_allow_overnight_times.sql`
   One statement: `ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_time_check;`
   with a comment saying why (a night's sleep is one row whose end is
   earlier than its start; the API now decides what may cross midnight).
   No column, no table. The builder cannot apply it to the live database;
   the owner does (see Done when).

2. `src/lib/overnight.ts` — pure, no React, no fetch. Imports only
   `timeToMinutes`, `minutesToTime` from `./time-utils` and
   `shiftDateString`, `TimeCategory` from `./types`.
   - `crossesMidnight(start?: string | null, end?: string | null): boolean`
     — as defined above.
   - `type OvernightPlacement = 'wake-day' | 'start-day'`
   - `overnightPlacement(start: string, end: string): OvernightPlacement`
     — `1440 − s > e ? 'start-day' : 'wake-day'`.
   - `overnightDuration(start: string, end: string): number` — `1440 − s + e`.
   - `normalizeMidnightEnd(start: string | null, end: string | null): string | null`
     — returns `'24:00'` when end is `00:00` (any seconds) and start is
     later than `00:00`; otherwise end unchanged.
   - `onDayTimes(entry: { start_time: string | null; end_time: string | null }): { start: string; end: string | null } | null`
     — the part of the entry that sits on its own date. No start → null.
     Not crossing → its own times (as `HH:MM`). Crossing and wake-day →
     `{ start: '00:00', end }`. Crossing and start-day →
     `{ start, end: '24:00' }`.
   - `splitAtMidnight(date: string, start: string, end: string)` → two
     pieces: `{ date, start_time: start, end_time: '24:00', duration_minutes: 1440 − s }`
     and `{ date: shiftDateString(date, 1), start_time: '00:00', end_time: end, duration_minutes: e }`.
   - `interface CoveredBlock { entryId: string; activity: string; category: TimeCategory | null; startTime: string; endTime: string; homeDate: string }`
   - `coveredOn(date: string, rows: { id; date; activity; category; start_time; end_time }[]): CoveredBlock[]`
     — for each row that crosses midnight: wake-day and
     `row.date === shiftDateString(date, 1)` → block `start`–`24:00` on
     `date`; start-day and `row.date === shiftDateString(date, -1)` → block
     `00:00`–`end` on `date`. Rows dated `date` itself give nothing.
   - `planOvernightSave(row, isSleep: boolean)` where `row` has
     `date, start_time, end_time, duration_minutes` plus any other fields:
     - first applies `normalizeMidnightEnd`;
     - not crossing → `[row]` unchanged apart from the normalised end;
     - crossing and `isSleep` → `[{ ...row, duration_minutes: overnightDuration }]`;
     - crossing and not sleep → the two `splitAtMidnight` pieces, each
       carrying the row's other fields.

3. `src/hooks/useOvernightSpill.ts` —
   `useOvernightSpill(date: string | null, refreshKey?: unknown): CoveredBlock[]`.
   Fetches `fetchEntries({ dateFrom: shiftDateString(date, -1), dateTo: shiftDateString(date, 1), fields: 'id,date,activity,category,start_time,end_time,status' })`
   and returns `coveredOn(date, rows)`. Caches per date in `sessionStorage`
   (key `overnight-spill:<date>`), loads from the cache first and refreshes
   silently — the pattern in CLAUDE.md principle 8. Refetches when
   `refreshKey` changes. Pending and confirmed rows both count.

4. `src/components/timeline/TimelineCovered.tsx` — one covered block on the
   grid, positioned like `TimelineEntry` (`PIXELS_PER_MINUTE`, `startHour`).
   Neutral: `bg-secondary text-muted-foreground`, same radius as an entry,
   no drag, no click. Two lines: the activity, then
   `Counted on <weekday of homeDate>` (e.g. "Counted on Tuesday"). Text
   12px or larger.

5. Tests (see Done when): `src/__tests__/overnight.test.ts`,
   `src/__tests__/api/entries-overnight.test.ts`,
   `src/__tests__/quicklog-overnight.test.tsx`.

### Changed

6. `src/app/api/entries/route.ts` — `POST`.
   - Accept one optional, never-stored field per item: `overnight_sleep`
     (boolean).
   - For each input item, after building the row: `isSleep` is
     `row.category === 'sleep'`, or, when `row.category` is null,
     `item.overnight_sleep === true`. Replace the row with
     `planOvernightSave(row, isSleep)` (so the list of rows can grow).
     A null category with no hint is treated as not sleep. The server
     never calls the model.
   - The second piece of a split copies `activity, category, description,
     status`; its `commentary` is the first piece's.
   - `MAX_BATCH` is checked against the input, as now.
   - Response: the single form returns the first row (the piece on the day
     it started), so every caller still reads `data.id`. The batch form
     returns all rows.
   - `GET` is untouched.

7. `src/app/api/entries/[id]/route.ts` — `PUT`.
   - Accept `overnight_sleep` the same way (not in `allowedFields`, never
     written).
   - Read the stored row first (`id` + `user_id`; 404 if absent).
   - **The rule runs only when the save changes the times**: the body has
     `start_time` or `end_time` and its `HH:MM` differs from the stored
     row's. A save that changes only category, status, date, activity,
     notes or commentary is written exactly as today — so a category
     change neither splits nor rejoins, and confirming a plan changes
     nothing about its times.
   - When it runs: merge stored row + updates, call `planOvernightSave`
     with `isSleep` from the merged category (or the hint when the merged
     category is null).
     - one row back → update as today, with the normalised end and, if it
       crosses, the recomputed `duration_minutes`.
     - two rows back → insert the second piece first (same `user_id`,
       activity, category, description, status, commentary), then update
       this row to the first piece. If the update fails, delete the row
       just inserted and answer 500. Return the first piece as `data`.
   - `DELETE` is untouched.

8. `src/lib/api.ts` — add `overnight_sleep?: boolean` to
   `CreateEntryParams`; let `updateEntry` take
   `Partial<TimeEntry> & { overnight_sleep?: boolean }`.

9. `src/components/QuickLogModal.tsx` — `handleSubmit`, and one new view.
   This is the add button and the unaccounted row (both open this modal).
   Keep `entryDate`, the overlap check and everything else as they are;
   add a branch taken only when `crossesMidnight(startTime, endTime)`:
   1. Get the category once: `knownCategory` if the existing rule for it
      applies, otherwise one `/api/categorize` call — **also in planning
      mode**. If the call fails, set the error `Failed to categorize
      activity` and save nothing.
   2. `onToday` = not `isFutureDay`, not `isPastDay`, and the view is today
      (`isOnTodayView`).
   3. **Sleep** (`category === 'sleep'`):
      - Ask **"Is this tonight's sleep?"** when `onToday`, placement is
        `wake-day`, and `getUserCurrentHour() >= 18`.
        - **Yes** → `createEntry` with `date: shiftDateString(entryDate, 1)`,
          `status: 'pending'`, `category: null`,
          `commentary: PENDING_COMMENTARY.planned`, `overnight_sleep: true`.
          Then what the planned branch does today (`onEntryAdded`, `onClose`).
        - **No, last night's** → as the next bullet.
      - Otherwise (and on "No"): if `isFutureDay`, save pending on
        `entryDate` with `category: null`, the planned commentary and
        `overnight_sleep: true`. If not, save **confirmed** on `entryDate`
        with `category: 'sleep'` — even though its start time reads as
        later than now, because a wake-day sleep began yesterday. Then the
        existing confirmed tail (`updateEntry(... { commentary: 'Logged' })`,
        `onEntryAdded`, reset or close). One exception: a `start-day`
        sleep on today whose start is still ahead of now
        (`isFutureStartTime`) is a plan — pending, `overnight_sleep: true`.
   4. **Not sleep**:
      - Ask **"Did this start yesterday?"** when `onToday` and
        `isFutureStartTime`.
        - **Yes** → `createEntry` with `date: shiftDateString(entryDate, -1)`,
          `status: 'confirmed'`, the category already fetched. The server
          splits it into yesterday and today. Then the confirmed tail.
        - **No, it's tonight** → `createEntry` on `entryDate`,
          `status: 'pending'`, `category: null`, planned commentary. The
          server splits it into today and tomorrow. Then the planned tail.
      - No question: save as the modal would today (planning mode →
        pending with null category; otherwise confirmed with the
        category), and the server splits it.
   - The question is a view inside this modal's `DialogContent`, replacing
     the form (like `showPostSubmit` does): the question as the title, one
     line under it with the activity and the times
     (`formatTimeDisplay(startTime)`–`formatTimeDisplay(endTime)`), a
     primary `Button` "Yes" and an outline `Button` with the "No, ..."
     wording above. Closing the modal while it shows saves nothing. Reset
     the view in the same effect that resets the form on open.
   - Send `duration_minutes: duration` as now (`calculateDuration` already
     wraps); the server recomputes for anything that crosses.

10. `src/components/TimeEntryModal.tsx` — `handleSave` only. If
    `crossesMidnight(startTime, endTime)` and `newCategory` is null (a
    planned entry), make one `/api/categorize` call and add
    `overnight_sleep: category === 'sleep'` to the update; on failure show
    the error and do not save. No question is asked when editing. Nothing
    else changes: the server applies the rule.

11. `src/lib/gaps.ts` — `findUnaccountedGaps`.
    - New optional param `covered?: { startTime: string; endTime: string }[]`,
      pushed into `busy` like events.
    - For entries, use `onDayTimes(entry)` for start and end instead of the
      raw times; keep the existing fallback (`start + duration_minutes`)
      when there is no end. An entry ending `00:00` still runs to midnight.
    - Update the header comment.

12. `src/app/log/[period]/page.tsx` — call
    `useOvernightSpill(selectedDate, entries)` and pass the result as
    `covered` to `findUnaccountedGaps`. Nothing else on this screen.

13. `src/lib/session-utils.ts` — `getEntriesForPeriod`,
    `splitEntryByPeriod`, `findFirstGapInPeriod`: take start and end from
    `onDayTimes(entry)`. A wake-day sleep on Tuesday is then a Morning
    entry (00:00–07:00), not an Evening one.

14. `src/lib/reminders.ts` — `alreadyLogged`: entries become
    `{ start_time: string | null; end_time?: string | null }[]` and the
    hour comes from `onDayTimes(entry)?.start`.
    `src/app/api/cron/reminders/route.ts` line ~167: select
    `start_time, end_time`. Without this a night's sleep logged on Tuesday
    would count as Tuesday's evening and silence that reminder. No other
    reminder rule changes.

15. `src/app/api/day-summary/route.ts` (~line 133): the hour an entry is
    placed in comes from `onDayTimes(entry)?.start`. `startTime`/`endTime`
    passed on stay the entry's real times.

16. `src/hooks/useTimelineData.ts` and `src/components/TimelineView.tsx`.
    - `smartPlaceEntries` (the copy inside `useTimelineData.ts`): for a
      timed entry, `placedStartTime`/`placedEndTime` come from
      `onDayTimes`. `findGaps` and the `timeGaps` memo use `onDayTimes`
      too, and the `timeGaps` memo also treats covered blocks as occupied.
    - `useTimelineData` takes `covered?: CoveredBlock[]`; `TimelineView`
      takes the same prop, passes it down, and renders one
      `TimelineCovered` per block under the entries.
    - `src/components/timeline/TimelineEntry.tsx`: when
      `crossesMidnight(entry.start_time, entry.end_time)`, the time text
      and duration shown are the entry's real ones
      (`entry.start_time`–`entry.end_time`, `entry.duration_minutes`), not
      the placed ones; position and height stay from the placed times.
    - `src/hooks/useEntryAdjustment.ts`: `handleEntryMouseDown` and
      `handleEntryTouchStart` return early for an entry that crosses
      midnight — it opens on a tap and cannot be dragged or resized
      (a drag would write the clipped times back).

17. `src/app/calendar/page.tsx`.
    - `const covered = useOvernightSpill(selectedDate, entries)`; pass it
      to `<TimelineView covered={covered} />`.
    - `dayItems`: sort by `onDayTimes(entry)?.start`; show the entry's
      real times.
    - `busyBlocks`: entries use `onDayTimes`; add the covered blocks, so
      the planner never proposes a task over a spilled sleep.
    - `blocksForGlance` call: pass `covered`.

18. `src/components/DayAtAGlance.tsx` — `blocksForGlance` takes
    `covered?: CoveredBlock[]`. Entries use `onDayTimes` (this removes the
    present skip of any entry whose end is before its start). Each covered
    block is drawn in the colour its entry has on its own day
    (`AGGREGATED_HEX[...]`, same expression as for entries).

19. `src/components/ActivityList.tsx` — sort by `onDayTimes(entry)?.start`
    instead of raw `start_time`. Displayed times stay the real ones.

20. `src/lib/habits.ts` — `usualWakeMinutes`: a sleep that crosses
    midnight with `wake-day` placement and an end at or before 12:00
    counts, with its end as that date's wake time. (Today the line
    `if (end <= start ...) continue` throws away exactly the nights this
    change makes saveable.) Same-day sleeps as now.

21. `CLAUDE.md`.
    - Under "AI API Calls", after the DON'T about pending entries, add the
      exception: a planned entry that crosses midnight is categorised once
      at save, only to tell sleep from the rest (owner-approved); the
      category is not stored.
    - A new "Common Pitfalls" section, "Entries across midnight", saying:
      the split rule; that sleep is one row and may have an end earlier
      than its start; the majority rule with the tie to the wake-up day;
      that anything placing an entry in a day uses `onDayTimes` from
      `lib/overnight.ts` and never the raw times; that the neighbouring
      day's part is `coveredOn` — display only, never summed; that the
      rule runs when a save changes the times and never reaches back; the
      two questions; that the server never calls the model.
    - "Database Schema": note that `end_time` may be earlier than
      `start_time` for an overnight sleep and that an end at midnight is
      stored as `24:00`.
    - "File Structure": add `lib/overnight.ts`.

## Steps

1. Write `src/lib/overnight.ts` and `src/__tests__/overnight.test.ts`. Run
   the test.
2. Add the migration file.
3. Change `POST /api/entries` and `PUT /api/entries/[id]`; write
   `src/__tests__/api/entries-overnight.test.ts` following the mocking in
   `src/__tests__/api/entries.test.ts`. Run it and the existing
   `entries.test.ts` and `batch-logging.test.ts`.
4. `src/lib/api.ts` types.
5. `QuickLogModal.tsx` branch and question view;
   `src/__tests__/quicklog-overnight.test.tsx` following
   `src/__tests__/quicklog-from-gap.test.tsx`.
6. `TimeEntryModal.tsx` hint.
7. Readers: `gaps.ts`, `session-utils.ts`, `reminders.ts` + the cron route,
   `day-summary`, `habits.ts`, `ActivityList.tsx`. Update or add cases in
   `gaps.test.ts`, `session-utils.test.ts`, `reminders.test.ts`,
   `habits.test.ts`. A case in `gaps.test.ts` that encodes "an entry whose
   end is before its start runs to midnight" changes to the new rule; the
   same case for calendar *events* stays.
8. `useOvernightSpill`, `TimelineCovered`, `useTimelineData`,
   `TimelineView`, `TimelineEntry`, `useEntryAdjustment`, the Plan page,
   `DayAtAGlance`, the session page.
9. `CLAUDE.md`.
10. Run every check under Done when.

## Rules that apply

- Branch: work on `dev`; never touch `main`.
- AI API Calls: do not categorise pending entries — with the one new
  exception above; use one call, not one per piece. No per-entry commentary
  for the second piece of a split.
- Dates: `shiftDateString` / `getLocalDateString` only; never a
  `toISOString()` round trip. `npm run test:tz` must pass.
- Reminders: who gets one and when is unchanged; only which part of the
  day an overnight sleep counts as logged.
- Timeline: still 24 hours; a covered block, like a calendar block, cannot
  be dragged.
- Principle 2 (muted palette): the covered block on the grid is neutral;
  any data colour comes from `lib/palette.ts`. No Tailwind saturated scale.
- Principle 3: the question is inside the existing bottom sheet; one
  primary button.
- Principle 5: nothing under 12px.
- Principle 7 / "do not change how sleep is scored":
  `lib/metrics-calc.ts` is not touched. A one-piece sleep counts its whole
  `duration_minutes` on its own date and nothing on the neighbour.
- Principle 8: `useOvernightSpill` caches in `sessionStorage`.
- Principle 11/12: the wake time read from the log keeps working
  (`usualWakeMinutes`).
- "A new table is also something to export and delete": no new table, so
  `lib/account-data.ts` is not touched.
- Nothing else imports `next-auth`; every route that calls OpenAI checks
  the session and rate-limits — the entries routes must not call OpenAI.

## Do not

- Do not link the two halves of a split: no column, no shared id, no
  matching on later edits. After the save they are two ordinary entries.
- Do not change `MAX_RANGE_MINUTES` or enforce a new length limit.
- Do not touch `lib/metrics-calc.ts` or any scoring.
- Do not change anything for an entry inside one day. An entry ending
  exactly at midnight is not split and asks nothing; the only difference
  is that the server stores a typed `00:00` end as `24:00` (what dragging
  on the timeline already writes).
- Do not split or rejoin on a category change, and do not rewrite existing
  rows: no backfill, no data migration.
- Do not call the model from `/api/entries`.
- Do not add questions to editing, to confirming a calendar event, or to
  `NextUp`; they get the rule from the server and nothing more.
- Do not show a toast or message saying an entry was split.
- Do not change the overlap check in `QuickLogModal` or
  `GhostEntryModal`; for crossing times it finds nothing, as now.
- Do not change `isEntryInFuture`, `suggestions/route.ts`,
  `window-alignment.ts`, `plan-adherence.ts`, `calendar-match.ts` or
  `repeat-session.ts`.
- Do not change the unused copies of `findGaps` / `smartPlaceEntries` in
  `src/components/timeline/utils.ts` unless something imports them.
- Do not apply the migration, push, or merge.

## Done when

Checks the builder runs:

- `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run build` pass;
  `npm run lint` stays at its current count (note the count before
  starting).
- `overnight.test.ts` covers: 23:00–07:00 is wake-day; 18:00–01:00 is
  start-day; 20:00–04:00 (tie) is wake-day; 23:00–00:00 and 23:00–24:00 do
  not cross; `onDayTimes` for each; `splitAtMidnight('2026-11-16',
  '23:00', '01:00')` gives Monday 23:00–24:00 (60) and Tuesday 00:00–01:00
  (60); `coveredOn` gives Monday 23:00–24:00 for a Tuesday 23:00–07:00
  sleep and Tuesday 00:00–01:00 for a Monday 18:00–01:00 sleep, and
  nothing for the entry's own date; a month-end date splits into the next
  month.
- `entries-overnight.test.ts` covers, for POST: dinner (category
  `meals`) 23:00–01:00 inserts two rows and returns the first; sleep
  23:00–07:00 inserts one row with `duration_minutes` 480; null category
  with `overnight_sleep: true` inserts one row; null category without it
  inserts two; an entry inside one day and one ending `00:00` insert one
  row (the latter with end `24:00`); a batch with one crossing event
  inserts one extra row. For PUT: changing times so a `meals` entry
  crosses inserts the second piece and shortens the first; changing only
  the category of a stored 23:00–07:00 row writes just the category; a
  sleep whose times change stays one row; `overnight_sleep` is never
  written.
- `quicklog-overnight.test.tsx` covers: dinner 23:00–01:00 typed on today
  in the morning shows "Did this start yesterday?"; Yes posts yesterday's
  date as confirmed with the category; "No, it's tonight" posts today's
  date as pending with a null category; sleep 23:00–07:00 in the morning
  asks nothing and posts confirmed `sleep` on today; the same in the
  evening (hour ≥ 18) shows "Is this tonight's sleep?" and Yes posts
  tomorrow's date as pending with `overnight_sleep: true`; exactly one
  `/api/categorize` call in each case; an entry inside one day behaves as
  before (existing QuickLog tests still pass unchanged).
- `gaps.test.ts`: a Tuesday 23:00–07:00 sleep leaves Tuesday evening
  23:00–24:00 unaccounted and covers 00:00–07:00; a `covered` block
  23:00–24:00 is never offered as a gap.
- `reminders.test.ts`: a 23:00–07:00 sleep counts as the morning logged,
  not the evening.
- `habits.test.ts`: three days of 23:00–07:00 sleep give a usual wake time
  of 07:00.

To look at in the app (on the preview, after the owner has applied the
migration to the database — until then a one-piece sleep still fails to
save, exactly as today; splits work either way):

- Monday: dinner 11:00 PM–1:00 AM saves as Monday 11:00 PM–12:00 AM and
  Tuesday 12:00 AM–1:00 AM, each in its own day's totals.
- Tuesday morning, same dinner: "Did this start yesterday?" Yes gives the
  same two entries; "No, it's tonight" gives two planned entries, tonight
  and tomorrow.
- Tuesday: sleep 11:00 PM–7:00 AM is one entry on Tuesday, eight hours in
  Tuesday's Body score, in Tuesday's Morning session; Monday's Plan
  timeline shows 11 PM–12 AM covered ("Counted on Tuesday") and Monday's
  Evening session offers no unaccounted row for that hour.
- Monday: sleep 6:00 PM–1:00 AM is one entry on Monday; Tuesday shows
  12–1 AM covered.
- Monday evening: sleep 11:00 PM–7:00 AM asks "Is this tonight's sleep?";
  Yes puts it on Tuesday as a plan.
- The same from the add button, an unaccounted row, editing an entry's
  times, and confirming a calendar event that runs past midnight.
- An ordinary entry and one ending at midnight save as before.

## Not decided

nothing

## Who should build and review this

- *Build with* **Opus**. The brief names every file and function, but the
  change crosses about twenty files, two API routes and a three-way branch
  in the largest component; several readers have to be changed by reading
  them, not by pattern.
- *Review with* **Fable**. It drops a database constraint, changes what
  both entry routes write, and touches the reminders' "already logged"
  check — mistakes there are costly and hard to see on screen.
- *Effort*: high. The save branch in `QuickLogModal` and the PUT rule have
  many cases, and each has a stated outcome to check against.
