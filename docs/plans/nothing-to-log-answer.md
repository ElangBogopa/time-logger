# "Nothing to log" is an answer, and Today shows it

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: 'Nothing to log' is an answer Today shows, with an Undo inside the session". It stays as the record of what was asked.

## Goal

When a person taps "Nothing to log for this session", Today stops asking
about that session: the row takes the done colour and reads "Nothing to
log". Inside the session an "Undo" puts it back to waiting. The answer is
already saved to the account (it follows the person to every device); this
change makes the app show it and lets it be taken back.

## What is already true (do not rebuild it)

- Tapping the button already saves a row in `session_completions` with
  `skipped = true` (`handleSkip` in `src/app/log/[period]/page.tsx`, through
  `upsertSessionCompletion` in `src/lib/api.ts` and `POST
  /api/session-completions`). One row per person, date and period.
- `session_completions` is already in `ACCOUNT_TABLES`
  (`src/lib/account-data.ts`, `columns: '*'`), so the answer is already in
  the export and already removed by account deletion. **No new table, no
  new column, no migration.**
- The reminder job already sends no reminder for a session that has any
  `session_completions` row (`alreadyLogged` in `src/lib/reminders.ts`).
  The owner has decided this stays exactly as it is.
- `GET /api/day-summary` already leaves skipped rows out of its count
  (`completions.filter(c => !c.skipped)`). Scores and reviews are computed
  from entries. None of that changes.
- What is missing: Today ignores a skipped row (`hasCompletion` is false
  for it, so the row says "Tap to log" / "Not logged"), the session screen
  never reads completions at all, and there is no way to remove the row.

## Files

1. `src/lib/types.ts` — add `nothingToLog: boolean` to `SessionInfo`.
2. `src/lib/session-utils.ts` — `buildSessionInfos` sets `nothingToLog`.
3. `src/app/page.tsx` — the "Your day" row shows the answered state.
4. `src/app/api/session-completions/route.ts` — add `DELETE`.
5. `src/lib/api.ts` — add `deleteSessionCompletion`.
6. `src/hooks/useSessionData.ts` — let the session screen read and update
   the cached completions.
7. `src/app/log/[period]/page.tsx` — read the answer, show it with Undo,
   and report a failed save.
8. Tests: `src/__tests__/session-utils.test.ts` (add),
   `src/__tests__/api/session-completions-delete.test.ts` (new),
   `src/__tests__/session-nothing-to-log.test.tsx` (new), and the `@/lib/api`
   mocks in `src/__tests__/session-not-started.test.tsx`,
   `src/__tests__/session-capture-view.test.tsx` and
   `src/__tests__/confirm-all-calendar.test.tsx`.

## Steps

### 1. `SessionInfo.nothingToLog`

In `src/lib/types.ts`, add to `SessionInfo`:

```ts
nothingToLog: boolean  // the person said "Nothing to log", and nothing is logged there
```

In `buildSessionInfos` (`src/lib/session-utils.ts`) set it:

```ts
nothingToLog: !!completion?.skipped && stats.entryCount === 0,
```

Leave `hasCompletion`, `state` and `getSessionState` as they are. The rule
in words: the answer shows only while the session has no entries. As soon
as an entry's start time falls in the session, `nothingToLog` is false and
the row is whatever an ordinary session with entries is. The saved row is
not deleted when an entry is logged; it is simply not shown. (Pressing
"Done with …" later overwrites it with `skipped: false`, as it does today.)

### 2. Today row (`src/app/page.tsx`, the `sessionInfos.map` under "Your day")

Add `const isAnswered = info.nothingToLog`. Then:

- `rowTint`: `isDone || isAnswered` gives `STATUS_CLASSES.green.tintStrong`.
- `iconColour`: `isDone || isAnswered` gives `STATUS_CLASSES.green.icon`.
- `subtitle`: when `isAnswered`, the text is exactly `Nothing to log`.
  Check this first, before the existing branches, so it never reads
  "Tap to log", "Not logged" or "0 entries".
- Right-hand mark: `isDone || isAnswered` shows the same `Check` tick the
  done row shows.
- `isPartial` is unchanged (it needs entries, and an answered row has none).
- Update the comment above (`// Three states…`) to say there are four and
  that the answered one is told apart by its words.
- `onClick` is unchanged: the row still opens the session.

This applies on any date Today can show, past days included.

### 3. `DELETE /api/session-completions?date=YYYY-MM-DD&period=morning`

In `src/app/api/session-completions/route.ts`, add a `DELETE` handler in
the style of the two beside it:

- `getAppSession()`; no `session.user.id` gives 401.
- Read `date` and `period` with `new URL(request.url).searchParams` (as
  `GET` does). `date` must match `/^\d{4}-\d{2}-\d{2}$/` and `period` must
  be one of `morning | afternoon | evening`; otherwise 400.
- Delete with all four filters:
  `.from('session_completions').delete().eq('user_id', session.user.id).eq('date', date).eq('period', period).eq('skipped', true)`.
  The `skipped = true` filter is deliberate: Undo takes back a "Nothing to
  log" answer and must never remove a session that was wrapped up with
  "Done".
- Supabase error gives 500 `{ error: 'Failed to undo' }`; success gives
  `{ success: true }`, also when there was no row to remove.
- No rate limiter is needed (the neighbouring handlers have none). The
  CSRF check is done by `src/middleware.ts` for every mutating API call.

### 4. `deleteSessionCompletion` in `src/lib/api.ts`

Beside `upsertSessionCompletion`:

```ts
export async function deleteSessionCompletion(params: { date: string; period: string }): Promise<void> {
  const searchParams = new URLSearchParams({ date: params.date, period: params.period })
  await fetchJSON(`/api/session-completions?${searchParams}`, { method: 'DELETE' })
}
```

`fetchJSON` adds the CSRF header and throws on a non-OK answer.

### 5. Shared cache (`src/hooks/useSessionData.ts`)

The in-memory `sessionDataCache` is what stops Today flashing stale state.
Today `setCachedEntries` creates an entry with `completions: []`, which
claims "no completions" when the truth is "not known".

- Change `SessionCacheEntry.completions` to `SessionCompletion[] | null`;
  `setCachedEntries` creates new entries with `completions: null`.
- In `useSessionData`, read it as `cached?.completions ?? []` in both
  places (the `useState` initialiser and the top of `fetchData`).
- Export:

```ts
/** Cached completions for a date, or null when they have not been fetched. */
export function getCachedCompletions(date: string): SessionCompletion[] | null

/** Replace (or add) one period's completion in the cache, after saving it. */
export function setCachedCompletion(date: string, completion: SessionCompletion): void

/** Drop one period's completion from the cache, after an undo. */
export function removeCachedCompletion(date: string, period: TimePeriod): void
```

`setCachedCompletion` and `removeCachedCompletion` do nothing useful when
the date has no cache entry or its completions are `null` — leave the cache
alone in that case (Today fetches on mount anyway).

### 6. Session screen (`src/app/log/[period]/page.tsx`)

- State: `const [answered, setAnswered] = useState<boolean | null>(…)`,
  where `null` means not known yet. Initialise from
  `getCachedCompletions(selectedDate)`: if it is not null, `answered` is
  whether it holds a row for this period with `skipped === true`;
  otherwise `null`.
- An effect (deps `userId`, `selectedDate`, `safePeriod`) calls
  `fetchSessionCompletions({ date: selectedDate, period: safePeriod })`
  and sets `answered` to `rows.some(r => r.skipped)`. On failure set it to
  `false` (the button shows, as today). Use a `cancelled` flag like the
  repeat-candidate effect above it. This runs for locked days too.
- `const showAnswered = answered === true && periodEntries.length === 0`.
- `handleSkip`: on success call `setCachedCompletion(selectedDate, row)`
  with the returned row (cast to `SessionCompletion`), then `goHome()`.
  On failure do **not** go home: `sonnerToast.error('Could not save that. Try again.')`
  and stay. (Today it swallowed the error and went home, where the session
  was still asking.)
- `handleUndo`: `await deleteSessionCompletion({ date: selectedDate, period })`;
  on success `removeCachedCompletion(selectedDate, period)` and
  `setAnswered(false)`, staying on the screen; on failure
  `sonnerToast.error('Could not undo that. Try again.')`. Guard against a
  double tap with an `isUndoing` flag that disables the button.
- In the action area (`!isLocked && hasStarted`), where the page now picks
  between "Done with …" and "Nothing to log for this session":
  - entries exist: "Done with {label}", unchanged;
  - no entries and `showAnswered`: a quiet row in place of the button —
    `flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3`
    with the text `Nothing to log for this session`
    (`text-sm text-muted-foreground`) and
    `<Button variant="outline" onClick={handleUndo} disabled={isUndoing}>Undo</Button>`
    (default size, 44px);
  - no entries and `answered === false`: the existing
    "Nothing to log for this session" button, unchanged;
  - no entries and `answered === null`: render nothing in this slot, so
    the button does not flash before the answer arrives.
- Locked days (`isLocked`): when `showAnswered`, show the line
  `Nothing to log for this session` (`text-sm text-muted-foreground`,
  centred) above the existing "This day is locked" box, with no Undo.
- The add button (the floating plus) and everything else on the screen
  stay as they are: the person can still add something. Once an entry
  lands in the session `showAnswered` is false and "Done with …" shows.

### 7. Tests

- `session-utils.test.ts`: a `describe('buildSessionInfos nothingToLog')`
  — skipped row and no entries is `true`; skipped row and an entry in that
  period is `false`; a non-skipped row is `false`; a skipped morning does
  not mark the afternoon; `hasCompletion` stays `false` for a skipped row.
- `api/session-completions-delete.test.ts` (model the mocks on
  `src/__tests__/api/goals-delete.test.ts`): 401 without a session; 400
  for a bad date and for a bad period; the delete is filtered by
  `user_id`, `date`, `period` **and** `skipped = true`; 500 on a database
  error; 200 otherwise.
- `session-nothing-to-log.test.tsx` (model the mocks on
  `session-not-started.test.tsx`, hour 19, evening, no entries):
  - a skipped row from `fetchSessionCompletions` shows the note and an
    "Undo" button and no "Nothing to log for this session" button;
  - tapping Undo calls `deleteSessionCompletion` with the date and period,
    and the "Nothing to log for this session" button returns;
  - a skipped row plus an evening entry shows "Done with Evening" and no
    note;
  - tapping "Nothing to log for this session" when the save rejects shows
    the error toast and does not call `router.push`.
- In the three existing tests that render the session page, add
  `fetchSessionCompletions: jest.fn(async () => [])` and
  `deleteSessionCompletion: jest.fn()` to the `jest.mock('@/lib/api', …)`
  factory. Their assertions should not need to change.

## Rules that apply

- Branch: work on `dev`; never touch `main`.
- Principle 2 (muted palette): the done colour comes from
  `STATUS_CLASSES.green` in `lib/palette.ts`; no new colour, no Tailwind
  saturated scale.
- Principle 3 (minimal UI): the note is a line and one outline button, not
  a new card of cards; touch targets 44px.
- Principle 5 (type): nothing under 12px; secondary text is
  `text-muted-foreground` at full strength.
- Principle 7 (one scoring system): this adds no number and changes none.
- Principle 8 (no loading flash): the session screen reads the answer from
  the shared cache first and Today is handed the new state through it.
- Principle 9 (time-aware labels): the answered row never reads
  "Not logged".
- "A new table is also something to export and to delete": no new table;
  `session_completions` is already listed. Do not change `ACCOUNT_TABLES`.
- "Who is signed in": the new handler uses `getAppSession()`; nothing new
  imports `next-auth`.
- Dates: `selectedDate` strings as they are; no `toISOString()` round-trip.

## Do not

- Do not touch `src/lib/reminders.ts`, `src/app/api/cron/reminders/route.ts`,
  `src/__tests__/api/reminders-cron.test.ts`, the reminders screen or its
  copy. Reminder behaviour stays exactly as it is: a session marked
  "Nothing to log" gets no reminder; after Undo the row is gone, so that
  session's reminder goes out as normal if its hour has not passed. The
  owner knows and accepts this.
- Do not touch `lib/metrics-calc.ts`, `/api/day-summary`, `/api/day-review`,
  `/api/weekly-review`, `/api/year-pixels`, `lib/prompts.ts` or any review
  component. The reviews must not mention the answer or count it as
  logged time.
- Do not add a migration, a table, a column, or anything in
  `localStorage` / `sessionStorage` for this.
- Do not delete the saved row when an entry is logged; do not add calls to
  the entry-creating paths (`QuickLogModal`, `NextUp`, the calendar page).
- Do not change the `POST` or `GET` handlers, `getSessionState`, or the
  `SessionState` type.
- Do not change which days are locked (today and yesterday stay the only
  editable days).
- Do not edit `CLAUDE.md` or `docs/BUSINESS-CONTEXT.md`.

## Done when

- `npx tsc --noEmit` passes.
- `npm test` passes, including the new tests above.
- `npm run test:tz` passes.
- `npm run lint` stays at 54 warnings, 0 errors.
- `npm run build` passes.
- `git diff --stat` shows no change under `src/lib/reminders.ts`,
  `src/app/api/cron/`, `src/lib/metrics-calc.ts`, `src/lib/account-data.ts`
  or `supabase/`.
- In the app (`npm run dev`, phone width):
  1. Open a started session with nothing in it, tap "Nothing to log for
     this session". Today shows that row in the done green with a tick and
     the words "Nothing to log", with no "Tap to log" and no flash of the
     old state.
  2. Sign in in a second browser: the row looks the same there.
  3. Open the session: the note and "Undo" show in place of the button.
     Tap Undo: the button is back; Today shows the row waiting again.
  4. Mark it again, then add an entry in that session: Today shows the
     ordinary row for a session with entries ("1 entry"), no note.
  5. Do the same for yesterday's evening.
  6. The three rings and the day review read the same before and after.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**: every file, function, class name and string is
  named above; nothing is left to design.
- *Review with* **Opus**: there is a new delete endpoint on a person's
  data, but it removes one row, is scoped by the signed-in id and by
  `skipped = true`, has its own test, and the database's shape and the
  reminder code are untouched, so the default reviewer is enough.
- *Effort*: medium.
