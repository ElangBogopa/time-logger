# Session screen: Afternoon and Evening offer unaccounted time from the session's start

> **BUILT - do not run again.** Built on 2026-11-16 in the commit titled "Session gaps: Afternoon and Evening offer unaccounted time from the session start". It stays as the record of what was asked.

## Goal

On a session screen, a person can log any hour of the Afternoon or Evening
without going to the calendar screen. The "Unaccounted" rows in the
Afternoon and Evening start at the session's start (12:00 and 18:00), also
when nothing is logged yet in that session; the Morning stays exactly as it
is (starts from the first thing logged, and an empty Morning shows no row).

## What was found before planning (do not re-investigate)

- The rows come from `findUnaccountedGaps` in `src/lib/gaps.ts`. It sets
  `let cursor = merged[0].start // the first thing logged, not the session start`
  and returns `[]` when nothing busy falls in the window
  (`if (clipped.length === 0) return []`). That is the confirmed cause: in
  the Afternoon, 12:00–14:00 before a 14:00 entry is never offered, and an
  empty Afternoon offers nothing.
- The screen is `src/app/log/[period]/page.tsx` (`LogPeriodContent`). The
  `gaps` `useMemo` (about lines 365–377) calls `findUnaccountedGaps` with
  `entries: periodEntries`, `events: calendarEvents`, `periodStart: range.start`,
  `periodEnd: range.end`, and `nowMinutes` on today only
  (`getUserCurrentHour()` already returns 24–26 in the small hours, so the
  Evening keeps working after midnight).
- **The seam bug this change would expose.** `periodEntries` is
  `getEntriesForPeriod(visibleEntries, period)`, which keeps only entries
  that *start* in the session. A Morning entry 11:30–12:45 is therefore not
  passed to the Afternoon, so once the Afternoon searches from 12:00 it
  would offer 12:00–12:45 as unaccounted although it is logged. The same at
  18:00 for an Afternoon entry running past 6. `findUnaccountedGaps` already
  clips every block to the window, so the fix is to pass the whole day's
  `visibleEntries`. For the Morning this changes nothing: no entry that
  starts after 12:00 can fall inside 0:00–12:00.
- **The midnight bug this change would expose.** `findUnaccountedGaps` drops
  any block whose end is not after its start (`if (end > start) busy.push`).
  An Evening entry 22:00–00:00 (or 23:00–01:00) is dropped. Today that hides
  itself because an Evening with only that entry has no busy blocks and
  returns `[]`; searching from 18:00 it would show "6:00 PM – 12:00 AM · 6h
  unaccounted" over the logged time. Fix: a block whose end is at or before
  its start runs to 24:00 (`24 * 60`). Same for calendar events. The Morning
  cannot be affected (such a block starts in the evening and is clipped out
  of 0:00–12:00).
- Calendar events filtered for the session (`calendarEvents`, by start hour
  within `getFlexiblePeriodRange`, two hours either side) count as busy and
  are clipped to the window. An event 11:30–12:30 therefore covers
  12:00–12:30 in the Afternoon and nothing more; time outside an event is
  still offered. That is correct and stays; tests below pin it.
- **Loading.** The gaps `useMemo` does not look at `isLoading`. With no
  cached entries, the first render has `entries = []`; once an empty
  Afternoon offers a row, a wrong "12:00 PM – now" row would flash before
  the entries arrive. The test "asks nothing of a session that is still
  loading" in `src/__tests__/session-capture-view.test.tsx` states the
  intent. Return no gaps while `isLoading` is true.
- **The add sheet does not block 12:00.** `QuickLogModal`
  (`src/components/QuickLogModal.tsx`) takes the row's times through
  `initialStartTime` / `initialEndTime`; `TimeRangePicker` lists every slot
  00:00–23:45 with no minimum; on submit the only refusal is
  `findMostlyOverlapping` (more than half of the new stretch on one
  confirmed entry), and calendar events never block a save. A start in the
  past on today is not "planning mode" (`isFutureStartTime` compares with
  the device clock). The `suggestedEvent` calendar chip only changes the
  times when tapped. Nothing to fix here; a test guards it.
- `src/__tests__/session-capture-view.test.tsx` mocks `useParams` to
  `{ period: 'morning' }` and `getUserCurrentHour` to `11`, and pins
  `Date.prototype.getMinutes` to 0. `QuickLogModal` is mocked to a div
  showing `${initialStartTime}→${initialEndTime}`.
- `src/__tests__/quicklog-known-category.test.tsx` shows how to render the
  real `QuickLogModal` with `@/lib/api` mocked and `Element.prototype.scrollTo = jest.fn()`.

## Files

- `src/lib/gaps.ts`
  - Add `fromSessionStart?: boolean` to `FindGapsParams` (default `false`),
    with a doc comment: true for the Afternoon and Evening, whose start is
    a time people are awake; false for the Morning, which starts at
    midnight.
  - When `fromSessionStart` is true: the cursor starts at `windowStart`
    instead of `merged[0].start`, and an empty window (no busy blocks)
    returns one gap `windowStart → windowEnd` if it is at least
    `minimumMinutes`. When false, behaviour is exactly as now.
  - A block (entry or event) whose end is at or before its start is treated
    as ending at `24 * 60`.
  - Rewrite the file's header comment to say: Afternoon and Evening search
    from the session's start; the Morning from the first thing logged so
    nobody is asked about sleep; the far end is now on today.
- `src/app/log/[period]/page.tsx`, the `gaps` `useMemo` only:
  - `if (isLoading) return []` beside the existing `isLocked` check.
  - Pass `entries: visibleEntries` (not `periodEntries`).
  - Pass `fromSessionStart: period !== 'morning'`.
  - Update the dependency array (`isLoading`, `visibleEntries`, `period`;
    drop `periodEntries` if no longer used inside).
  - Update the comment above the memo in one or two sentences.
- `src/__tests__/gaps.test.ts`: add the unit cases below. Leave the existing
  cases as they are (they do not pass `fromSessionStart`), except rename
  "says nothing when the session is empty" to say it is about the Morning
  and run it with `...MORNING, nowMinutes: 11 * 60`.
- `src/__tests__/session-capture-view.test.tsx`: make the period and hour
  mutable (`let mockPeriod = 'morning'` and `let mockHour = 11`, read inside
  the `useParams` and `getUserCurrentHour` mocks; jest allows variables
  prefixed `mock` in factories), reset both in `beforeEach`, and add the
  screen cases below. Existing cases must pass unchanged.
- `src/__tests__/quicklog-from-gap.test.tsx` (new): the add-sheet case below.

## Steps

1. In `src/lib/gaps.ts`, add the midnight rule (end ≤ start → 24:00) for
   entries and events. Run `npx jest src/__tests__/gaps.test.ts`; all
   existing cases still pass.
2. Add `fromSessionStart` as described. Existing gaps tests still pass.
3. Add unit tests to `src/__tests__/gaps.test.ts`, with
   `EVENING = { periodStart: 18, periodEnd: 24 }`:
   - Afternoon, `fromSessionStart: true`, entry 14:00–15:00, `nowMinutes`
     15:00 → `[{ 12:00, 14:00, 120 }]`.
   - Empty Afternoon, `fromSessionStart: true`, `nowMinutes` 15:30 →
     `[{ 12:00, 15:30, 210 }]`.
   - Empty Afternoon on a finished day (no `nowMinutes`) → `[{ 12:00, 18:00, 360 }]`.
   - Empty Afternoon at 12:20 → `[]` (under 30 minutes); at 11:00 → `[]`
     (not started).
   - Afternoon at 15:00 with entry 12:10–15:00 → `[]` (the 10 minutes is
     under the minimum).
   - Evening, `fromSessionStart: true`, entry 19:00–20:00, `nowMinutes`
     21:00 → `[{ 18:00, 19:00, 60 }, { 20:00, 21:00, 60 }]`.
   - Empty Evening on a finished day → `[{ 18:00, 24:00, 360 }]`.
   - Seam: Afternoon, `fromSessionStart: true`, entry 11:30–12:45 (starts
     in the morning), `nowMinutes` 15:00 → `[{ 12:45, 15:00, 135 }]`. Same
     at 18:00: Evening, entry 17:15–18:40, `nowMinutes` 20:00 →
     `[{ 18:40, 20:00, 80 }]`.
   - Calendar event near lunch: Afternoon, `fromSessionStart: true`, event
     11:30–12:30, entry 14:00–15:00, `nowMinutes` 15:00 →
     `[{ 12:30, 14:00, 90 }]` (the event covers only its own half hour; the
     free hour after it is offered).
   - Midnight: finished Evening, `fromSessionStart: true`, entry
     22:00–00:00 → `[{ 18:00, 22:00, 240 }]`; entry 23:00–01:00 →
     `[{ 18:00, 23:00, 300 }]`.
   - Morning unchanged: `...MORNING` without `fromSessionStart`, entry
     08:30–09:00, `nowMinutes` 11:00 → `[{ 09:00, 11:00, 120 }]` (nothing
     from 00:00); empty Morning → `[]`.
4. Change the `gaps` memo in `src/app/log/[period]/page.tsx` as described.
5. Add screen tests to `src/__tests__/session-capture-view.test.tsx`:
   - Afternoon (`mockPeriod = 'afternoon'`, `mockHour = 15`), entries
     returned: one at 14:00–15:00 → the text `12:00 PM – 2:00 PM` and
     `2h unaccounted` appear; clicking the row shows the quick-log mock with
     `12:00→14:00`.
   - Empty Afternoon (`fetchEntries` resolves `[]`, hour 15) → a
     `12:00 PM – 3:00 PM` row with `3h unaccounted`; clicking it shows
     `12:00→15:00`.
   - Seam: Afternoon, hour 15, entries returned: one at 11:30–12:45 → a
     `12:45 PM – 3:00 PM` row and no row starting at `12:00 PM`.
   - Evening (`mockPeriod = 'evening'`, `mockHour = 21`), entry 19:00–20:00
     → rows `6:00 PM – 7:00 PM` and `8:00 PM – 9:00 PM`; clicking the first
     shows `18:00→19:00`.
   - Morning (the default setup) with `fetchEntries` resolving `[]` → no
     `Unaccounted` heading.
   - Loading: Afternoon, hour 15, `fetchEntries` returns a promise that
     has not resolved → no `Unaccounted` heading until it resolves.
   Use the exact strings `formatTimeDisplay` produces; if the dash or the
   AM/PM spacing differs from the above, match the existing test
   `'10:00 AM – 10:30 AM'`.
6. Add `src/__tests__/quicklog-from-gap.test.tsx`: render the real
   `QuickLogModal` for today (`getUserToday`/`getRealToday` mocked to one
   date, `isPastDay={false}`), with `initialStartTime="12:00"`,
   `initialEndTime="14:00"`, `fetchEntries` resolving one confirmed entry
   14:00–15:00, and `calendarEvents` holding an event "Team lunch"
   11:30–12:30. Pin the clock to 15:00 (`jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15)`
   and `getMinutes` to 0) so 12:00 is not in the future. Type "Lunch",
   open the time picker (click the Start button), pick `1:00 PM` in the End
   column (the second match of that text), click the Confirm button, then
   submit. Expect `createEntry` called once with `start_time: '12:00'`,
   `end_time: '13:00'`, `status: 'confirmed'`, and no overlap error text.
   `Element.prototype.scrollTo = jest.fn()` as in
   `quicklog-known-category.test.tsx`; mock `csrfFetch` to answer
   `{ category: 'meals' }`.
7. Run the full checks in "Done when".

## Rules that apply

- CLAUDE.md, Design principle 9 (time-aware): never ask about time that has
  not happened yet — `nowMinutes` on today stays the far end, and a session
  that has not begun shows nothing.
- Design principle 8 (no loading flash): the session screen must not show a
  wrong row while its entries load.
- Design principle 1 (mobile only): the rows already exist; no new UI.
- "Calendar API caching": do not fetch the calendar again; use the
  `calendarEvents` the screen already has.
- Timezone handling: no new date maths; minutes past midnight only.

## Do not

- Do not change the Morning's behaviour: it starts from the first thing
  logged and an empty Morning shows no row.
- Do not change the plus button (it still starts after the last entry), the
  "Open the calendar to drag, resize or plan ahead" link, session hours
  (`PERIOD_TIME_RANGES`, `getFlexiblePeriodRange`), the calendar screen, or
  calendar-event confirming (`confirmGhosts`, the "From your calendar"
  section).
- Do not change `QuickLogModal` or `TimeRangePicker` code; the test only
  guards them.
- Do not change the 30-minute minimum or make calendar events stop counting
  as accounted for.
- Do not make the sheet read "lunch" as 12–1 when opened from a row.
- Do not edit `CLAUDE.md`.

## Done when

- The new tests in `src/__tests__/gaps.test.ts`,
  `src/__tests__/session-capture-view.test.tsx` and
  `src/__tests__/quicklog-from-gap.test.tsx` pass, and every existing test in
  those files still passes.
- `npx tsc --noEmit` clean; `npm test` passes; `npm run test:tz` passes;
  `npm run lint` stays at 0 errors and 49 warnings; `npm run build` passes.
- In the app (Vercel preview on a phone): on today after 2pm with one
  entry at 2–3pm, the Afternoon screen shows "12:00 PM – 2:00 PM · 2h
  unaccounted"; tapping it opens the add sheet at 12:00–2:00; type Lunch,
  set the end to 1:00 PM, log — the entry appears and the row becomes
  1:00 PM – 2:00 PM. An empty Afternoon shows one row from 12:00 PM to now.
  After 6:30pm the Evening does the same from 6:00 PM. The Morning shows no
  row before the first thing logged, and none when empty.

## Not decided

Nothing.

## Who should build and review this

- *Build with* **Sonnet**: the change is two small edits to one function and
  one memo, fully specified with expected outputs.
- *Review with* **Opus**: a person can judge the rows on screen, but the
  seam and midnight edges are easy to miss by looking.
- *Effort*: medium.
