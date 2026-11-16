# Session log: "Same as <day>" lets a person pick which activities to log

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: "Same as <day>" opens a sheet to pick which activities to log". It stays as the record of what was asked.

## Goal

On the session log screen, the "Same as <day>" box stops being a one-tap
"log all". Tapping it opens a bottom sheet listing what is left of that
day's session; the person ticks what to log and logs the ticked rows in one
batch at their copied times, with their copied categories. The box stays
while anything is left. A row whose time mostly overlaps something already
logged cannot be ticked; tapping it opens the normal add screen prefilled
with its name, length and category so the person picks the time.

## What was found before planning (do not re-investigate)

- The screen is `src/app/log/[period]/page.tsx` (`LogPeriodContent`).
  - State `repeatCandidate` / `isRepeating` (about lines 122–123).
  - The lookup effect (about lines 183–208) is gated on
    `hasEntriesForPeriod` (`getEntriesForPeriod(entries, period).length > 0`);
    that gate is why the box disappears once the session has an entry.
  - `handleRepeatSession` (about lines 210–225) calls
    `createEntries(entriesForRepeat(repeatCandidate, selectedDate))`, then
    `fetchEntries()`, then `sonnerToast.success(\`Logged ${n} activity|activities from ${label}\`)`;
    on error `sonnerToast.error('Could not copy that session')`.
  - The box JSX (about lines 550–579): rendered when
    `!isLocked && hasStarted && repeatCandidate`; eyebrow "Same as
    {label}", the names joined by " · ", a `RotateCcw` icon, and the
    outline button "Log N activities again · <total>".
  - `entries` holds only confirmed entries for `selectedDate` (fetched with
    `status: 'confirmed'`). `visibleEntries` is `entries` minus soft-deleted
    ones (`pendingDeletes`).
  - The page already renders one `QuickLogModal` (about lines 777–799) for
    the floating button and the gap rows, opened by `isQuickLogOpen`, with
    times from `quickLogRange` (`initialStartTime` / `initialEndTime`).
- `src/lib/repeat-session.ts` holds `findRepeatCandidate` (which day is
  copied — do not change it), `describeDay`, `RepeatCandidate`
  (`entries` are sorted by start time and all have a `start_time`, because
  `getEntriesForPeriod` drops entries without one; `end_time` may be null),
  `RepeatableEntry` and `entriesForRepeat(candidate, date)`.
  Tests: `src/__tests__/repeat-session.test.ts`. Its `entry()` fixture sets
  `end_time` equal to `start_time`; new tests need a fixture with a real end.
- The add screen is `src/components/QuickLogModal.tsx`. Its "more than half"
  rule is inline in `handleSubmit` (about lines 407–430): an existing
  confirmed entry clashes when
  `overlap(new, existing) / (newEnd − newStart) > 0.5`, with `newEnd − newStart > 0`
  and entries without both times skipped; the first such entry is named in
  the error. `handleSubmit`'s confirmed branch (about lines 450–462) always
  POSTs `/api/categorize`. The `initialActivity` prop is NOT usable for this
  change: it turns the form into "Commit Task" with a read-only name and a
  "Commit to calendar" button.
- `src/lib/time-utils.ts` has `timeToMinutes`, `minutesToTime`,
  `addMinutesToTime`, `formatTimeDisplay`; `src/lib/session-utils.ts` has
  `formatSessionDuration` ("45m", "1h", "1h 30m").
- `src/components/ui/checkbox.tsx` (Radix) and `src/components/ui/dialog.tsx`
  (`DialogContent` is the app's bottom sheet) exist.
  `src/components/GoogleTasksPicker.tsx` is an existing example of a
  checkbox list inside `DialogContent`.
- `npm run lint` currently reports 0 errors, 54 warnings.

## Decided (the request left these open; build them as written)

- **Same name** means equal after trimming, collapsing runs of whitespace
  and lower-casing ("dentist " matches "Dentist").
- **What counts as an entry already in the session**: the confirmed entries
  on the selected date that are visible (`visibleEntries`, so an entry being
  soft-deleted no longer counts) and that fall in this session by
  `getEntriesForPeriod`. Pending (planned) entries do not count.
- **What a row clashes with**: any visible confirmed entry on the selected
  date (the whole day, as the add screen checks the whole day), by the add
  screen's rule. Ticked rows are not checked against each other. A row
  without an `end_time` never clashes.
- If two rows on the copied day share a name, logging one makes the other
  drop off too — that is the "same name" rule, kept as stated.
- **Closed box**: the whole box is one button (min 44px tall). Eyebrow
  "Same as {label}", under it the names of the rows left joined by " · ",
  and a `ChevronRight` where the `RotateCcw` icon was. No button inside it.
- **Sheet**: title "Same as {label}". Header row above the list: on the
  left "{n} left" in `text-sm text-muted-foreground`, on the right a text
  button "Select all" (min-h-11, `text-xs font-medium text-muted-foreground`,
  as "Confirm all" is styled on the same page). Once every tickable row is
  ticked it reads "Clear" and unticks them all. It is disabled when no row
  can be ticked.
- **Rows**: one card, `divide-y` (principle 3), the list scrolls inside the
  sheet (`max-h-[50vh] overflow-y-auto`). A tickable row is a `<label>`
  wrapping a `Checkbox` and the text, so tapping anywhere on it toggles it;
  min height 44px. Text: the activity name (`text-sm font-medium`), and
  under it "9:00 AM – 10:30 AM · 1h 30m" (`text-xs text-muted-foreground`,
  `formatTimeDisplay` and `formatSessionDuration`; with no end time, just
  the start and the length).
- **A clashing row** is a `<button>`, not a label: a muted `Clock` icon
  where the checkbox would be, the same name and time line, then a second
  line "Overlaps {activity} · pick a time", and a `ChevronRight` on the
  right. Tapping it closes the sheet and opens the add screen.
- **Primary button** (default `Button`, `size="lg"`, `w-full`): with n
  ticked, "Log {n} activity|activities · {total}" where total is the sum of
  the ticked rows' `duration_minutes` through `formatSessionDuration`. With
  nothing ticked it reads "Choose what to log" and is disabled. While
  logging it shows the `Loader2` spinner and the rows and Select all are
  disabled.
- Nothing is ticked each time the sheet opens. On success the sheet closes
  and the existing toast shows; on failure the existing error toast shows
  and the sheet stays open with the ticks kept.
- **The add screen from a clashing row**: the name field is the ordinary
  editable input, prefilled with the name (not auto-focused, so the
  keyboard does not cover the times). The times are prefilled to start at
  the end of the entry it overlaps and run for the row's length; if that
  would run past 23:59, the copied day's own start and end are used
  instead. The copied category is used, with no categorise call, as long as
  the name is unchanged (same-name rule above) and the category is not
  null; if the person retypes the name, or the category is null, it is
  categorised as it is today. A time in the future (on today) still makes
  it a planned entry with no category, as the add screen already does.

## Files

### `src/lib/time-utils.ts`

Add, next to `timeToMinutes`:

```ts
/**
 * The first entry that a new stretch of time mostly sits on: more than half
 * of the new stretch overlaps it. The add screen refuses such a time; the
 * "Same as" sheet will not tick such a row.
 */
export function findMostlyOverlapping<T extends { start_time?: string | null; end_time?: string | null }>(
  startTime: string,
  endTime: string,
  entries: readonly T[]
): T | undefined
```

Same arithmetic as the inline check in `QuickLogModal.handleSubmit`:
`newDuration = end − start`; skip entries without both times; clash when
`newDuration > 0 && overlap / newDuration > 0.5`.

### `src/components/QuickLogModal.tsx`

1. Replace the inline `existingEntries.find(...)` in `handleSubmit` with
   `findMostlyOverlapping(startTime, endTime, existingEntries)`. The error
   message and the surrounding `if` stay exactly as they are.
2. Add two optional props, documented in `QuickLogModalProps`:
   - `initialName?: string` — prefills the ordinary editable name input
     (unlike `initialActivity`, which is the read-only "Commit Task" mode).
   - `knownCategory?: TimeCategory | null` — used instead of
     `/api/categorize` when the name is unchanged.
3. In the open/reset effect, `setActivity(initialActivity || initialName || '')`,
   and skip the focus timeout when `initialName` is set. In
   `onOpenAutoFocus`, also `preventDefault()` when `initialName` is set.
4. In the confirmed branch of `handleSubmit`: if `knownCategory` is
   non-null and `initialName` is set and `sameActivityName(activity, initialName)`
   (from `@/lib/repeat-session`), use `knownCategory` and do not call
   `/api/categorize`; otherwise keep the existing call. The planning branch
   is unchanged.

Nothing else in the modal changes; `initialName` must not switch on any of
the `initialActivity` behaviour (title, read-only field, hidden notes,
button text).

### `src/lib/repeat-session.ts`

Update the file's header comment (it is no longer one tap). Add:

```ts
/** Equal after trimming, collapsing whitespace and lower-casing. */
export function sameActivityName(a: string, b: string): boolean

export interface RepeatRow {
  entry: TimeEntry
  /** The logged entry this row's time mostly sits on, if any. Such a row cannot be ticked. */
  clash: TimeEntry | null
}

/**
 * The candidate's entries that are still left to log on the selected date:
 * a row is gone once this session already has an entry with the same name,
 * however it was logged. Each left row says what it clashes with.
 *
 * @param dayEntries  the selected date's confirmed, visible entries (all sessions)
 */
export function repeatRowsLeft(candidate: RepeatCandidate, dayEntries: TimeEntry[], period: TimePeriod): RepeatRow[]

/** Where the add screen should start a clashing row: after the entry it overlaps, keeping its length. */
export function retimeAfterClash(row: RepeatRow): { startTime: string; endTime: string }
```

- `repeatRowsLeft`: session entries are `getEntriesForPeriod(dayEntries, period)`;
  drop candidate entries whose name matches any of them by
  `sameActivityName`; for the rest, `clash` is
  `findMostlyOverlapping(entry.start_time, entry.end_time, dayEntries) ?? null`
  when the entry has both times, else `null`. Keep candidate order.
- `retimeAfterClash`: start = `row.clash.end_time`, end = start +
  `row.entry.duration_minutes` (via `timeToMinutes` / `minutesToTime`); if
  there is no clash, no clash end time, or start + length > 23:59 (1439
  minutes), return the entry's own `start_time` / `end_time` (end falling
  back to start + length if null).
- Change `entriesForRepeat` to take the selection:
  `entriesForRepeat(candidate: RepeatCandidate, date: string, ids: ReadonlySet<string>): RepeatableEntry[]`
  — only the candidate entries whose `id` is in `ids`, in candidate order,
  built exactly as today (date, activity, category, duration, start, end).

### `src/components/RepeatSessionSheet.tsx` (new)

A presentational sheet; it does no fetching.

```ts
interface RepeatSessionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string            // "yesterday", "Monday", "27 Oct"
  rows: RepeatRow[]
  isLogging: boolean
  /** The ticked rows' entry ids. */
  onLog: (ids: Set<string>) => void
  onPickTime: (row: RepeatRow) => void
}
```

`Dialog` + `DialogContent` + `DialogHeader`/`DialogTitle` ("Same as
{label}") and an sr-only `DialogDescription`. Holds the ticked ids in
state, reset to empty whenever `open` becomes true. Before calling `onLog`,
keep only ids of rows that are still in `rows` and have no clash. Layout
and wording as in "Decided". Colours only from neutral tokens
(`text-muted-foreground`, `bg-card`, `border-border`) — no Tailwind
saturated scales (`palette-discipline.test.ts`).

### `src/app/log/[period]/page.tsx`

1. Lookup effect: remove the `hasEntriesForPeriod` gate and the variable
   (and from the deps). It still runs only when not locked and with a user
   and date, from the same 14 days, with `findRepeatCandidate` unchanged.
   Update the comment above it.
2. `const repeatRows = useMemo(() => repeatCandidate ? repeatRowsLeft(repeatCandidate, visibleEntries, period) : [], [...])`.
3. New state: `isRepeatSheetOpen`, and `quickLogPrefill: { name: string; category: TimeCategory | null } | null`.
4. `handleRepeatSession(ids: Set<string>)`: return if no candidate, already
   logging, or `ids.size === 0`; `createEntries(entriesForRepeat(repeatCandidate, selectedDate, ids))`;
   `await fetchEntries()`; close the sheet; same success toast text; same
   error toast, sheet left open.
5. `handlePickRepeatTime(row)`: close the sheet; set `quickLogRange` to
   `retimeAfterClash(row)`; set `quickLogPrefill` to
   `{ name: row.entry.activity, category: row.entry.category }`; open the
   quick log.
6. Box: render when `!isLocked && hasStarted && repeatCandidate && repeatRows.length > 0`,
   as the single button described in "Decided", names from `repeatRows`.
   Remove the outline "Log N activities again" button and the `RotateCcw`
   import if unused.
7. Render `<RepeatSessionSheet>` beside the other modals.
8. `QuickLogModal`: pass `initialName={quickLogPrefill?.name}` and
   `knownCategory={quickLogPrefill?.category}`; clear `quickLogPrefill`
   wherever `quickLogRange` is cleared (in `onClose` and `onEntryAdded`).

### Tests

- `src/__tests__/repeat-session.test.ts`: update the two existing
  `entriesForRepeat` tests to pass a set of all ids. Add a fixture with a
  real end time and these describes:
  - **what counts as left**: a hand-typed entry in the session with the same
    name (different case and spacing, different time) removes the row; one
    with a different name does not; a same-name entry in another session
    of the same day does not remove it; with every name logged the list is
    empty.
  - **what counts as a clash**: a row more than half covered by a logged
    entry has that entry as `clash`; exactly half is not a clash; a clash
    with an entry from another session counts; a row with no end time has
    no clash.
  - **entries built from a partial selection**: two ids of five give two
    entries, in candidate order, with the copied times, durations and
    categories; an empty set gives none.
  - `sameActivityName` and `retimeAfterClash` (after the clash; past
    midnight falls back to the copied times).
- `src/__tests__/time-utils.test.ts`: `findMostlyOverlapping` — just over
  half, exactly half, zero-length new stretch, entries missing times.
- `src/__tests__/repeat-session-sheet.test.tsx` (new, React Testing
  Library, rendering `RepeatSessionSheet` directly): nothing ticked on open
  and the button disabled with "Choose what to log"; ticking two rows reads
  "Log 2 activities · 1h 30m" and `onLog` gets those two ids; Select all
  ticks every row except the clashing one and then reads "Clear"; the
  clashing row shows "Overlaps Dentist · pick a time" and tapping it calls
  `onPickTime` with that row.
- If an existing page test (`session-capture-view.test.tsx`,
  `session-not-started.test.tsx`, `confirm-all-calendar.test.tsx`) starts
  failing because the box can now show alongside entries, fix the test's
  mock data, not the behaviour.

## Steps

1. Add `findMostlyOverlapping` and its tests; switch `QuickLogModal.handleSubmit`
   to it. `npm test -- time-utils` passes.
2. Add `sameActivityName`, `RepeatRow`, `repeatRowsLeft`, `retimeAfterClash`;
   change `entriesForRepeat`; update and add `repeat-session.test.ts`.
3. Add `initialName` / `knownCategory` to `QuickLogModal`.
4. Build `RepeatSessionSheet` and its test.
5. Wire the page: lookup gate, rows, box, sheet, prefill.
6. Run the checks in "Done when".

## Rules that apply

- CLAUDE.md "AI API Calls": the batch insert form of `/api/entries`; no
  categorise call for copied rows (categories come across); no per-entry
  commentary for the bulk action.
- Design principle 1: touch targets 44px+.
- Principle 2: neutral colours only; no saturated Tailwind scales.
- Principle 3: a list is one card with `divide-y`; one primary button per
  decision; modals are bottom sheets (`DialogContent`); toasts at the top.
- Principle 5: `eyebrow` for the box heading; nothing a person reads under
  12px; secondary text `text-muted-foreground` at full strength.
- Timezone: no new date maths; dates stay `selectedDate` strings.

## Do not

- Change `findRepeatCandidate`, the 14-day window, or when the box may
  appear (session started, day not locked).
- Add time editing inside the list, or any way to dismiss the box.
- Change `initialActivity` behaviour, the add screen's overlap message, or
  anything else in `QuickLogModal` beyond the listed edits.
- Call `/api/categorize` or `/api/commentary` from the sheet.
- Add sessionStorage caching for the repeat lookup (not part of this change).
- Touch `main`.

## Done when

- `npx tsc --noEmit` clean; `npm test` and `npm run test:tz` pass, including
  the new tests above; `npm run lint` stays at 0 errors and 54 warnings;
  `npm run build` succeeds.
- In the app, on a phone (dev preview): on a session whose copied day had
  five activities, tap the box — the sheet lists five, none ticked, button
  disabled; tick two, the button reads "Log 2 activities · <total>"; log —
  sheet closes, toast "Logged 2 activities from <day>", the box is still
  there naming the other three. Add a hand-typed entry with one of those
  names in this session — it drops off the box. With an entry logged over
  one row's time, that row shows "Overlaps … · pick a time", Select all
  skips it, tapping it opens the add screen with the name, length and times
  after the overlapping entry; save — it is logged with the copied category
  and drops off. When nothing is left the box is gone.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet** — the brief names every function, prop, string
  and test; no design choices are left to the builder.
- *Review with* **Opus** — ordinary UI and pure logic; no sign-in, data
  shape, deletion or reminders involved.
- *Effort*: medium.
