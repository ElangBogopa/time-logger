# Unaccounted rows end at a past half hour; the End picker opens where it should

> **BUILT - do not run again.** Built on 2026-11-16 in the commit titled "Unaccounted rows end at a past half hour; End picker opens where it should". It stays as the record of what was asked.

## Goal

Tapping an "Unaccounted" row whose stretch runs up to now opens an entry
that ends at the last half-hour mark already passed, so the row never fills
in time that has not happened (at 7:13 a gap from 6:00 opens 6:00–7:00).
And the End time list, wherever an end time is picked, never opens at
12:00 AM by accident: it opens at the time End holds, or one hour after
the start, and lists only times after the start.

## What was found before planning (do not re-investigate)

- The rows are built in `src/app/log/[period]/page.tsx` (`LogPeriodContent`):
  the `gaps` `useMemo` (about line 373) calls `findUnaccountedGaps` from
  `src/lib/gaps.ts` with `nowMinutes: isToday ? currentHour * 60 + new Date().getMinutes() : null`.
  A trailing gap on today therefore ends at the exact current minute
  (e.g. `07:13`). `handleFillGap(startTime, endTime)` (about line 388) puts
  those times straight into `setQuickLogRange`, which becomes
  `QuickLogModal`'s `initialStartTime` / `initialEndTime`.
- A gap is never shorter than 30 minutes (`minimumMinutes = 30`, the page
  does not pass another). Any stretch of 30 minutes or more contains a
  half-hour mark after its start, so through the row the "no half-hour
  mark has passed" fallback (use the current time) never actually fires;
  it is still written and unit-tested so the helper is safe on its own.
  The "at 6:20 it opens 6:00–6:20" check is therefore a unit test, not
  something visible on the screen (no row is shown for a 20-minute gap).
- When the clock is past the session's end, the window ends at the
  session end (`Math.min(periodEnd * 60, nowMinutes)`), so the trailing gap
  ends at e.g. `12:00` / `18:00` / `24:00`, not at now. Such a gap is not
  "up to the current time" and is not rounded.
- **Why End opens at 12:00 AM.** `src/components/TimeRangePicker.tsx`:
  `TimeColumn` scrolls to `TIME_SLOTS.indexOf(value)`; `TIME_SLOTS` is
  00:00–23:45 in 15-minute steps. An end such as `07:13` (from a gap row,
  or from the add button, which on today sets `setEndTime(getCurrentTime())`
  in `QuickLogModal`, about line 348) is not in the list, `indexOf` returns
  -1, nothing scrolls, and the column sits at its top: 12:00 AM. The End
  column also lists every slot of the day, including ones at or before the
  start. `handleOpen` defaults an empty End to start + 30.
- `TimeRangePicker` is used by `QuickLogModal` (the add button and the
  gap row) and `GhostEntryModal` (confirming a calendar event; it gets the
  fix for free). Both columns live in one sheet; tapping either the Start
  or the End button opens it.
- **Editing an entry does not use this picker.** `src/components/TimeEntryModal.tsx`
  (edit form, about lines 416–436) uses two native `<Input type="time">`
  fields (`edit-start`, `edit-end`). A native time input's wheel cannot be
  positioned or limited from the page, so the edit form must switch to
  `TimeRangePicker` to get the same behaviour. Its `useEffect` that
  recalculates `duration` from `startTime` / `endTime` already handles
  any change of either.
- Durations: `calculateDuration` treats an end at or before the start as
  past midnight; `TimeRangePicker`'s `isValidRange` caps a stretch at
  16 hours. Overnight entries (sleep 23:00–07:00, an Evening 22:00–00:00)
  must stay pickable.
- A gap can end at `24:00` (a finished Evening; `minutesToTime(1440)`
  returns `'24:00'`), which is not in `TIME_SLOTS` either.
- Existing test `src/__tests__/quicklog-from-gap.test.tsx` clicks
  `getAllByText(/^1:00\s?PM$/)[1]` (the End column's 1:00 PM, start 12:00).
  With the new End list 1:00 PM is still the second match, so it should
  pass unchanged.
- `src/__tests__/session-capture-view.test.tsx` already has mutable
  `mockPeriod` / `mockHour`, pins `Date.prototype.getMinutes` to 0 in
  `beforeEach`, and mocks `QuickLogModal` to a div
  (`data-testid="quick-log"`) showing `${initialStartTime}→${initialEndTime}`.
  `src/__tests__/entry-heart-line.test.tsx` shows how to render
  `TimeEntryModal`. Tests that render the real picker set
  `Element.prototype.scrollTo = jest.fn()`. Jest is v30, so
  `mock.contexts` tells which element a `scrollTo` call was made on.

## Decided (the request left these open)

- The row's own text is unchanged: at 7:13 it still reads
  "6:00 AM – 7:13 AM · 1h 13m unaccounted"; only the sheet it opens ends at
  7:00.
- The End list holds the 15-minute slots after the start, in order of time
  after the start, wrapping past midnight, up to 16 hours after the start
  (the existing cap). Start 6:00 lists 6:15 … 10:00 PM; start 11:00 PM
  lists 11:15 PM, 11:30 PM, 11:45 PM, 12:00 AM, 12:15 AM … 3:00 PM. Times
  later than 16 hours (which could not be confirmed anyway) are not listed.
  No "next day" label is added.
- "Positioned at" means that slot is the top row of the End column (the
  existing scroll convention); the earlier choices (6:15, 6:30, 6:45 for a
  6:00 start) sit just above, reached by scrolling up.
- "One hour after the start" for an off-grid start (e.g. 7:13) is the first
  listed slot at least 60 minutes after it (8:15).
- When End holds a time the list does not have (7:13, 8:10), the list is
  positioned at one hour after the start, nothing in it is highlighted, and
  the held time is kept: Confirm without tapping a slot saves the held
  time. It is not silently replaced.
- When End is empty, it is set to one hour after the start (was 30
  minutes), in both `handleOpen` branches that make up an end.
- A held `24:00` counts as the 12:00 AM slot (highlight and position), and
  a held midnight opens there: that is the entry's real end.
- Changing the Start inside the sheet still sets End to start + 30, as now;
  the End column then re-positions to it.
- The Start column is unchanged (still all 96 slots, still positioned only
  when its value is on the grid).
- The edit form in `TimeEntryModal` switches from the two native time
  fields to `TimeRangePicker` (the same Start / End buttons and sheet as
  the add sheet). The "Start Time" / "End Time" labels and `edit-start` /
  `edit-end` inputs go; the Duration field stays as it is.
- `CommitTimeModal` (giving a plan task a time) keeps its native fields; it
  is not one of the three places named.

## Files

- `src/lib/gaps.ts`
  - Add and export `entryEndForGap(gap: Gap, nowMinutes: number | null): string`
    with a doc comment. Rule: if `nowMinutes` is null, or
    `timeToMinutes(gap.endTime) !== nowMinutes`, return `gap.endTime`
    unchanged (a gap closed by a later entry, a finished day, or a session
    already over). Otherwise `mark = Math.floor(nowMinutes / 30) * 30`;
    return `minutesToTime(mark)` if `mark > timeToMinutes(gap.startTime)`,
    else `gap.endTime` (the current time). Never touches the start.
  - Add one sentence to the header comment: a row running up to now opens
    an entry ending at the last half hour passed.
- `src/app/log/[period]/page.tsx`
  - In the `gaps` memo, compute `nowMinutes` once and return
    `{ gaps, nowMinutes }` (or keep a second memo value) so the tap uses
    the same minute the row was built with. Rename uses accordingly
    (`gaps.length`, `gaps.map`).
  - `handleFillGap` takes the `Gap` and sets
    `setQuickLogRange({ startTime: gap.startTime, endTime: entryEndForGap(gap, nowMinutes) })`.
    The button's `onClick` passes `gap`. The row's markup and text do not
    change.
- `src/lib/time-slots.ts` (new), pure helpers with doc comments:
  - `TIME_SLOTS: string[]` — 00:00 … 23:45 in 15-minute steps (moved here
    from `TimeRangePicker.tsx`).
  - `MAX_RANGE_MINUTES = 16 * 60`.
  - `endSlotsAfter(start: string): string[]` — every slot whose minutes
    after `start` (`(slot − start + 1440) % 1440`) is greater than 0 and at
    most `MAX_RANGE_MINUTES`, sorted by that elapsed time.
  - `defaultEndAfter(start: string): string` — the first slot of
    `endSlotsAfter(start)` that is at least 60 minutes after the start.
  - `normalizeEnd(end: string): string` — `'24:00'` → `'00:00'`, otherwise
    unchanged.
  - `endScrollTarget(start: string, end: string): string` —
    `normalizeEnd(end)` if it is in `endSlotsAfter(start)`, else
    `defaultEndAfter(start)`.
- `src/components/TimeRangePicker.tsx`
  - Import `TIME_SLOTS`, `MAX_RANGE_MINUTES`, `endSlotsAfter`,
    `defaultEndAfter`, `endScrollTarget`, `normalizeEnd`; delete the local
    `generateTimeSlots` / `TIME_SLOTS`. `isValidRange` uses
    `MAX_RANGE_MINUTES`.
  - `TimeColumn` gains `slots: string[]` and `scrollTarget: string` props
    and a `testId` (`data-testid` on the scrolling div:
    `time-column-start` / `time-column-end`). It renders `slots`, scrolls
    (behaviour `'auto'`) to `slots.indexOf(scrollTarget) * itemHeight` in
    an effect on `[scrollTarget, slots]`, and highlights
    `slot === normalizeEnd(value)` (harmless for the Start column).
    `handleSelect` is unchanged (smooth scroll to the tapped slot).
  - Start column: `slots={TIME_SLOTS}`, `scrollTarget={tempStart}`.
    End column: `slots={endSlots}` where
    `const endSlots = useMemo(() => tempStart ? endSlotsAfter(tempStart) : TIME_SLOTS, [tempStart])`,
    `scrollTarget={tempStart ? endScrollTarget(tempStart, tempEnd) : tempEnd}`.
  - `handleOpen`: the "have start, no end" branch sets
    `tempEnd = defaultEndAfter(startTime)`; the "no start" branch sets
    `tempEnd = defaultEndAfter(defaultStart)`. The "both set" branch is
    unchanged (keeps the held end, on the grid or not).
  - `handleStartChange` unchanged.
- `src/components/TimeEntryModal.tsx`
  - Replace the "Start & End Time" grid (the two `Label` + `Input type="time"`
    blocks) with
    `<TimeRangePicker startTime={startTime} endTime={endTime} onStartTimeChange={setStartTime} onEndTimeChange={setEndTime} />`
    inside a `div className="space-y-2"` with `<Label>Time</Label>` above
    it, matching `QuickLogModal`. Import `TimeRangePicker`. Nothing else in
    the form changes.
- `src/__tests__/gaps.test.ts` — add an `entryEndForGap` describe block.
- `src/__tests__/time-slots.test.ts` (new).
- `src/__tests__/time-range-picker.test.tsx` (new).
- `src/__tests__/session-capture-view.test.tsx` — add the screen cases.
- `src/__tests__/entry-edit-times.test.tsx` (new) — the edit form case.

## Steps

1. Add `entryEndForGap` to `src/lib/gaps.ts`. Tests in `gaps.test.ts`,
   each with a `Gap` built as `{ startTime, endTime, durationMinutes }`:
   - 06:00–07:13, now 7:13 (433) → `'07:00'`.
   - 06:00–06:20, now 380 → `'06:20'`.
   - 06:40–06:55, now 415 → `'06:55'`.
   - 06:40–07:05, now 425 → `'07:00'`.
   - 06:00–07:30, now 450 → `'07:30'` (on the mark).
   - 06:00–08:10, now 9:00 (540) → `'08:10'` (closed by an entry).
   - 06:00–07:13, now null → `'07:13'` (finished day).
   - 12:00–18:00, now 19:00 (1140) → `'18:00'` (session over).
   Run `npx jest src/__tests__/gaps.test.ts`.
2. Change the page's `gaps` memo and `handleFillGap` as described. Add to
   `session-capture-view.test.tsx` (inside a new describe):
   - `mockPeriod = 'afternoon'`, `mockHour = 15`, `getMinutes` mocked to
     13 in the test, entries returned: one 14:00–14:30. Rows
     `12:00 PM – 2:00 PM` and `2:30 PM – 3:13 PM` appear (wording
     unchanged). Clicking the second shows the quick-log mock with
     `14:30→15:00`; clicking the first (after closing, or in its own test)
     shows `12:00→14:00` (closed by the entry, not rounded).
   - Existing cases pass unchanged.
3. Create `src/lib/time-slots.ts`. Tests in `time-slots.test.ts`:
   - `endSlotsAfter('06:00')` starts `['06:15','06:30','06:45','07:00']`,
     ends with `'22:00'`, has 64 items, and contains no slot from
     `'00:00'` to `'06:00'`.
   - `endSlotsAfter('23:00')` starts `['23:15','23:30','23:45','00:00','00:15']`
     and ends with `'15:00'`; does not contain `'22:45'` or `'23:00'`.
   - `endSlotsAfter('07:13')` starts with `'07:15'`.
   - `defaultEndAfter('06:00')` → `'07:00'`; `defaultEndAfter('07:13')` → `'08:15'`;
     `defaultEndAfter('23:30')` → `'00:30'`.
   - `endScrollTarget('06:00','07:00')` → `'07:00'`;
     `('06:00','')` → `'07:00'`; `('06:00','07:13')` → `'07:00'`;
     `('06:00','08:10')` → `'07:00'`; `('06:00','05:00')` → `'07:00'`;
     `('18:00','24:00')` → `'00:00'`.
4. Change `TimeRangePicker.tsx` as described. Tests in
   `time-range-picker.test.tsx` (`Element.prototype.scrollTo = jest.fn()`
   reset in `beforeEach`; render `TimeRangePicker` with jest.fn handlers;
   click the button containing "End" to open the sheet; find the End
   column with `getByTestId('time-column-end')`):
   - Start `06:00`, End `''`: the End column contains `7:00 AM` and
     `6:30 AM` and not `6:00 AM`, `5:45 AM` or `12:00 AM`; the last
     `scrollTo` call whose `mock.contexts` entry is the End column has
     `top: 3 * 48` (7:00 is fourth); 7:00 AM is the highlighted slot
     (has `bg-primary`); the confirm button reads `Confirm 1h` (or the
     `formatDuration(60)` text).
   - Start `06:00`, End `07:00`: End column scrolled to `top: 3 * 48`.
   - Start `06:00`, End `07:13`: End column scrolled to `top: 3 * 48`, no
     slot in it has `bg-primary`, and clicking Confirm calls
     `onEndTimeChange('07:13')`.
   - Start `23:00`, End `''`: End column contains `12:00 AM` and `1:00 AM`
     and not `10:45 PM`; scrolled to 12:00 AM (`top: 3 * 48`).
   - Tapping `6:30 AM` in the End column (start 06:00) then Confirm calls
     `onEndTimeChange('06:30')`.
   - `quicklog-from-gap.test.tsx` and `quicklog-known-category.test.tsx`
     still pass.
5. Change `TimeEntryModal.tsx` as described. Test in
   `entry-edit-times.test.tsx`: render `TimeEntryModal` as
   `entry-heart-line.test.tsx` does, with a confirmed entry 06:00–07:00,
   click the edit button (`Edit`), then the End button; the End column
   (`time-column-end`) does not contain `6:00 AM`, and is scrolled to
   `top: 3 * 48`. Pick `7:30 AM`, Confirm, and the Duration field shows
   `90`. Run the other `TimeEntryModal` tests
   (`entry-heart-line.test.tsx`, `toast-behavior.test.tsx`).
6. Run the checks under "Done when".

## Rules that apply

- Design principle 1 (mobile only): the picker's rows stay 48px, touch
  targets 44px+.
- Design principle 3: everything modal is a sheet from the bottom; the
  picker is already `DialogContent`. The edit form gains no new chrome
  beyond the same Start / End buttons the add sheet has.
- Design principle 2: no new colours; the existing classes stay.
- Timezone handling: no dates are touched; "now" stays
  `getUserCurrentHour()` and `new Date().getMinutes()` as the page already
  does.
- Planning ahead must keep working: no rule anywhere refuses an end time in
  the future.

## Do not

- Do not change the Unaccounted row's wording, its duration text, or when
  a row appears (`findUnaccountedGaps` stays as it is; the 30-minute
  minimum stays).
- Do not round a gap's start, or the end of a gap closed by a later entry.
- Do not add any block on future end times in the picker, `QuickLogModal`
  or `TimeEntryModal`; planned future entries must keep working.
- Do not change the Start column, `handleStartChange`, the 16-hour cap,
  `CommitTimeModal`, `DayWindowsCard`, or `GhostEntryModal`'s own code.
- Do not change how `QuickLogModal` picks its initial times.

## Done when

- The new and changed tests above pass.
- `npx tsc --noEmit` is clean.
- `npm test` passes; `npm run test:tz` passes.
- `npm run lint` stays at 0 errors and 49 warnings (no new warnings).
- `npm run build` succeeds.
- In the app (dev preview, on today): at a minute that is not a half hour,
  open a session with a gap running to now; the row reads its exact
  minute, and tapping it opens the add sheet ending at the last half
  hour. A gap before a later entry opens ending at that entry's start.
  Tap End: the list opens at the held end (or an hour after the start if
  End is off the grid or empty), shows nothing at or before the start,
  and scrolling up reaches the half hour after the start. The same from
  the add button (End holds the current minute, so it opens an hour after
  the start) and from an entry's Edit form.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**: every function, rule and test case is named
  here; nothing needs a design call.
- *Review with* **Opus**: it touches the add sheet, the edit form and the
  confirm-a-calendar-event sheet at once, and a slot-list mistake
  (midnight, off-grid times) would be easy to miss on screen.
- *Effort*: medium.
