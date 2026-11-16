# Reminders forgive a late run, and each goes out at most once a day

> **BUILT - do not run again.** Built on 2026-11-16 in the commit titled "Reminders forgive a late run: each goes out once, within its window". It stays as the record of what was asked.

Planned 2026-11-16 on `dev` at `af869f9`.

## Goal

GitHub's scheduler runs the hourly reminders job only a few times a day, so
a reminder goes out only if a run happens to land in its exact hour, and
most days none arrive. After this change a run that arrives late still
sends the reminder that was missed, each reminder goes out at most once per
person per day, and nothing about a day is sent after its midnight.

## The rule (read this before the steps)

All hours and dates are the person's own (`localClock(now, timezone)`).

- **Which reminder a run considers.** Exactly one: the switched-on reminder
  with the latest hour that is at or before the person's current hour. With
  the usual times that makes the windows the owner asked for: "Log your
  morning" from 12:00 until 18:00, "Log your afternoon" from 18:00 until
  21:00, "Log your evening" from 21:00 until midnight. A window closes when
  the next switched-on reminder's hour arrives, or at midnight. Before the
  first reminder's hour (which includes just after midnight) there is no
  candidate, so nothing about yesterday is ever sent.
- **Never an older one.** If the candidate has already been sent, or its
  part of the day is already logged, the run sends nothing to that person.
  It does not fall back to an earlier reminder. So when two are unsent,
  only the latest goes out, and never two at once.
- **Once a day.** A new table, `reminder_sends`, holds one row per person,
  per local date, per reminder id. A reminder with a row is not sent again
  that day: not by a second run in the window, not after the person moves
  its time or switches it off and on.
- **Every device, once.** One row covers the person; the single run that
  writes the row sends to every device the person has subscribed.
- **Claim, then send.** The row is inserted *before* the pushes go out, and
  the unique constraint is what makes two overlapping runs safe: the second
  insert fails and that run sends nothing. If the pushes reach no device at
  all (every one failed or was gone), the row is deleted again so a later
  run in the same window can try again. If at least one device got it, the
  row stays.
- **Already logged is not recorded.** A skipped reminder writes no row.
  The next run asks again whether that part of the day is logged.
- **If the record cannot be read, nothing is sent and the job answers
  500.** This includes the table not existing yet (the migration is applied
  by the owner, by hand). Sending without the record would repeat the same
  reminder on every run. The workflow goes red, which is the signal that
  the migration has not been applied.
- **If the row cannot be written** for a reason other than "already there",
  that person is not sent to in this run, an error is logged, and the
  `notRecorded` count goes up.

Unchanged: who gets reminders (the push subscription, nothing else), the
skip when that part of the day is logged (and "send anyway if that cannot
be found out"), the three titles and bodies, the three default times, the
counts-never-who answer, dead-device removal, and `/api/push/test`, which
writes no row and is not touched.

## Files

- **`supabase/migrations/20261116_reminder_sends.sql`** (new) - the table.
  Written, not applied: the owner applies it to the real database.
- **`src/lib/reminders.ts`** - `dueReminder` changes meaning from "set for
  this exact hour" to "latest switched-on one at or before this hour".
- **`src/app/api/cron/reminders/route.ts`** - read the day's record, claim
  before sending, release the claim if no device got it; new counts.
- **`src/lib/account-data.ts`** - add `reminder_sends` to `ACCOUNT_TABLES`.
- **`src/__tests__/reminders.test.ts`** - `dueReminder` tests rewritten.
- **`src/__tests__/api/reminders-cron.test.ts`** - fake database learns
  `insert`; existing tests adjusted to the new rule; new tests below.
- **`CLAUDE.md`** - the Reminders section, step 6.

Nothing else. In particular not `.github/workflows/reminders.yml`, not
`src/app/api/push/test/route.ts`, not `src/app/api/cron/engagement/`, not
`src/app/settings/notifications/page.tsx`.

## Steps

### 1. The migration: `supabase/migrations/20261116_reminder_sends.sql`

Dated filename on purpose (see the note at the top of
`20261102_commentary_replies.sql`: dated files sort after `033_`).

```sql
-- Which reminder has been sent to whom, on which of their days.
--
-- The hourly reminders job is called late, or not at all, by a scheduler
-- that drops runs. So a reminder may be sent any time in its window, and
-- this is how a second run in the same window knows not to send it again.
-- One row per person, per local date, per reminder.
--
-- The UNIQUE constraint is the guard: the job inserts the row before it
-- sends, and a second insert fails.

CREATE TABLE IF NOT EXISTS reminder_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The date where the person is, not the server's.
  date DATE NOT NULL,
  -- 'midday' | 'evening' | 'night': the ids in user_preferences.reminder_times.
  reminder_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, date, reminder_id)
);

CREATE INDEX IF NOT EXISTS idx_reminder_sends_user_date
  ON reminder_sends(user_id, date);

-- RLS: deny-all (service role key bypasses)
ALTER TABLE reminder_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON reminder_sends;

CREATE POLICY "Deny direct access - use server" ON reminder_sends
  FOR ALL USING (false);

COMMENT ON TABLE reminder_sends IS
  'One row per reminder sent to a person on one of their local dates, so a late or repeated run never sends it twice.';
```

`user_id` is `UUID` with the foreign key because the job takes the id from
`push_subscriptions.user_id`, which is the same type with the same key.

Do not run this against any database. Do not use the Supabase CLI or MCP.

### 2. `src/lib/account-data.ts`

Add as the **last** entry of `ACCOUNT_TABLES`, after `push_subscriptions`
(the subscription goes first, so the job has nobody to send to before its
record is cleared):

```ts
  // After the subscription: once that is gone the job writes no more of these.
  { table: 'reminder_sends', ownerType: 'uuid', export: { as: 'remindersSent', columns: '*' } },
```

Nothing else in this file changes. `allRows` orders by `id`, which the
table has; `withoutOwner` drops `user_id` from the exported rows. Do not
add anything to `NOT_INCLUDED`.

### 3. `src/lib/reminders.ts`

Replace `dueReminder` (same name, same signature, new meaning):

```ts
/**
 * The one reminder a run at this hour may send: the switched-on reminder
 * with the latest hour that has already come today. A run that arrives
 * late still finds it, until the next reminder's hour takes over or the
 * day ends. An earlier one that was missed is left: one reminder at a
 * time, and the most recent part of the day is the one still remembered.
 */
export function dueReminder(times: ReminderTime[] | null | undefined, hour: number): ReminderTime | null
```

- Consider only entries with `enabled` true and `reminderHour(time.time)`
  between 0 and `hour` inclusive (so an unreadable time, `-1`, is ignored).
- Return the one with the greatest `reminderHour`; on a tie, the later one
  in the list. None → `null`.

Update the file's header comment (the first block) with two sentences on
lateness: the job is called late and irregularly, so each reminder has a
window that runs until the next one's hour or midnight, and
`reminder_sends` is what stops a second send. Update the comment on
`reminderHour` only if it has become untrue (it has not: minutes are still
ignored). Change nothing else: `REMINDER_KINDS`, `localClock`,
`alreadyLogged`, `notificationFor`, `reminderLabel`, `formatHour` stay
byte-for-byte.

### 4. `src/app/api/cron/reminders/route.ts`

Keep the auth check, the `pushConfigured` check, the subscriptions read,
`devicesByUser`, the preferences read, `done()` and `isLogged()` as they
are. Change the rest of `GET` to:

1. `counts` becomes
   `{ subscribers, due: 0, alreadySent: 0, alreadyLogged: 0, notRecorded: 0, sent: 0, failed: 0, removed: 0 }`.
2. `const now = new Date()`. First pass over `devicesByUser`: for each
   person compute `clock = localClock(now, prefs?.timezone)` and
   `reminder = dueReminder(prefs?.reminder_times ?? DEFAULT_REMINDER_TIMES, clock.hour)`.
   Keep those with a reminder in an array of
   `{ userId, devices, clock, reminder }`; `counts.due` is its length.
   If it is empty, `return done(counts)` (no record read needed).
3. Read the record once:
   ```ts
   const { data: sends, error: sendsError } = await supabase
     .from('reminder_sends')
     .select('user_id, date, reminder_id')
     .in('user_id', candidates.map((c) => c.userId))
     .in('date', [...new Set(candidates.map((c) => c.clock.date))])
   ```
   On `sendsError`: `console.error('[Reminders] Could not read what has been sent:', sendsError.message)`
   and answer `{ error: 'Database error' }` with status 500, sending
   nothing. Build a `Set` of `` `${user_id}|${date}|${reminder_id}` ``.
4. For each candidate, in this order:
   - Key in the set → `counts.alreadySent++`, continue.
   - `REMINDER_KINDS[reminder.id]` exists and
     `await isLogged(userId, clock.date, kind.period)` →
     `counts.alreadyLogged++`, continue. No row is written.
   - Claim: `const { error } = await supabase.from('reminder_sends').insert({ user_id: userId, date: clock.date, reminder_id: reminder.id })`.
     - `error?.code === '23505'` (another run got there first) →
       `counts.alreadySent++`, continue.
     - any other error →
       `console.error('[Reminders] Could not record a send:', error.message)`,
       `counts.notRecorded++`, continue. Never log the user id.
   - Send to every device exactly as now (`sent` / `failed` / removed with
     the subscription row deleted). Track whether any device answered
     `'sent'` for this person.
   - If none did, release the claim:
     `await supabase.from('reminder_sends').delete().eq('user_id', userId).eq('date', clock.date).eq('reminder_id', reminder.id)`.
5. `return done(counts)`.

Rewrite the doc comment above `GET`: it sends "whichever reminder each
person is still owed", not "due this hour"; say that the caller is meant to
be hourly but arrives late and drops runs, that each reminder therefore has
a window, and that `reminder_sends` is claimed before sending. Keep the
paragraph about the subscription being the switch and the last line about
counts.

The answer still contains only `success` and numbers.

### 5. Tests

**`src/__tests__/reminders.test.ts`** - rewrite the `which reminder is due`
block for the new meaning, keeping one test per point:

- at 12, 18 and 21 it is `midday`, `evening`, `night` (as now);
- late in a window it is still that one: 13 and 17 → `midday`, 19 and 20 →
  `evening`, 22 and 23 → `night`;
- before the first hour there is none: 0, 7, 11 → `null`;
- a reminder switched off is passed over and the one before it keeps its
  window: with `evening` off, 19 → `midday`; with `midday` off, 13 → `null`;
- a moved time moves the window: `midday` at `'14:00'` → 13 is `null`, 14 is
  `midday`;
- `12:30` counts from 12 (minutes ignored);
- a time that is not one, and `null` times, give `null` (as now).

**`src/__tests__/api/reminders-cron.test.ts`**

Fake database: add `reminder_sends: []` to the `db` set up in `beforeEach`,
and teach `makeBuilder` an `insert(row)` that, when run: returns
`{ data: null, error: { message: 'boom' } }` if the table is in `broken`;
for `reminder_sends`, returns `{ data: null, error: { code: '23505', message: 'duplicate key' } }`
when a row with the same `user_id`, `date` and `reminder_id` exists;
otherwise pushes the row and returns no error. Add a second list,
`blind: string[]` (reset in `beforeEach`), of tables whose `select` returns
no rows while insert and delete still see them: that is how a test stages
two runs racing.

Existing tests: the default fixture runs at 17:05 UTC with a Toronto and a
London subscriber. Under the new rule London (17:05) is inside the morning
window too, so several expectations change. Go through every existing test,
keep the point it makes and its name where the name is still true, and move
the instant or the expectation. Do not delete a test because it fails.
Known ones:

- "reminds the person whose clock says noon, and not the one whose clock
  says five": use an instant where one clock is past noon and the other is
  not, e.g. `2026-11-12T13:05:00Z` (London 13:05 gets "Log your morning";
  Toronto, 08:05, gets nothing). Rename to match.
- "sends each of the three in its own hour across a day": the loop from
  00:05Z to 23:05Z on the 12th starts at 19:05 on the 11th in Toronto, so
  the expected list becomes
  `['0Z Log your afternoon', '2Z Log your evening', '17Z Log your morning', '23Z Log your afternoon']`.
  Rename to say each goes once in its window and never again.
- "answers with counts and never with who": the exact body gains
  `alreadySent` and `notRecorded`, and `due` / `sent` reflect both
  subscribers being in the morning window at 17:05Z. Assert the full
  object, and that it holds neither user id nor `push.example`.
- "respects a reminder switched off, and one moved to another hour",
  the multi-device count, "forgets a device…", "keeps a device after a
  failure…" and the already-logged tests: recompute for two people in the
  window, or narrow `db.push_subscriptions` to one person where the test is
  about one person.

New tests, in a block `describe('a run that arrives late', …)`, each with
`db.push_subscriptions = [device(TORONTO)]` unless it says otherwise
(Toronto is UTC-5 on these dates):

1. **A late run sends the missed reminder.** `2026-11-12T19:05:00Z` (14:05)
   → `Log your morning`. And `2026-11-13T04:55:00Z` (23:55 on the 12th) →
   `Log your evening`.
2. **A second run in the same window does not repeat it.** Call at
   `17:05Z`, then at `19:05Z`: `sendPush` called once in total; the second
   answer has `alreadySent: 1, sent: 0`.
3. **Only the latest missed one goes out.** First run of the day at
   `2026-11-12T23:30:00Z` (18:30): only `Log your afternoon`. A further run
   at `2026-11-13T00:30:00Z` (19:30) sends nothing: the morning one is not
   gone back for.
4. **Nothing is sent after midnight.** No earlier runs; one run at
   `2026-11-13T05:05:00Z` (00:05 on the 13th) sends nothing and
   `db.reminder_sends` stays empty.
5. **A part of the day already logged is still skipped on a late run, and
   leaves no record.** Morning entry on `2026-11-12`, run at `19:05Z`:
   nothing sent, `alreadyLogged: 1`, `db.reminder_sends` empty.
6. **Every device gets it once.** Two devices for Toronto, runs at `17:05Z`
   and `19:05Z`: `sendPush` called twice in total, once per device, and
   `db.reminder_sends` holds one row.
7. **The record is under the person's own date.** Run at
   `TORONTO_NINE_PM`: the row is
   `{ user_id: TORONTO, date: '2026-11-12', reminder_id: 'night' }`.
8. **A send that reached no device is not counted as sent.** `sendPush`
   resolves `'failed'` at `17:05Z`: `db.reminder_sends` is empty afterwards;
   with `sendPush` back to `'sent'`, a run at `19:05Z` delivers it. And the
   other side: two devices, one `'sent'` and one `'failed'` → the row stays
   and a later run sends nothing.
9. **Two runs at once send one.** Put the row for today's `midday` in
   `db.reminder_sends`, add `'reminder_sends'` to `blind`, call at `17:05Z`:
   nothing sent, `alreadySent: 1`.
10. **If it cannot read what has been sent, it sends nothing and says so.**
    `broken = ['reminder_sends']` → status 500, `sendPush` not called
    (silence `console.error` as the neighbouring test does).
11. **If it cannot write the record, it does not send.** Make only the
    insert fail (for example a second flag beside `broken`, such as
    `brokenInserts`): `sendPush` not called, `notRecorded: 1`.

The `POST /api/push/test` block stays as it is and must still pass; add one
assertion to its "sends one notification" test that `db.reminder_sends` is
still empty.

`src/__tests__/api/account.test.ts` needs no edit: it seeds and checks every
table in `ACCOUNT_TABLES`, and its "knows every table the app reads or
writes" test is what would have failed had step 2 been skipped. Confirm it
passes.

### 6. `CLAUDE.md`, the "### Reminders" section only

Replace the first bullet ("Three a day …") with these two, and leave the
other bullets as they are:

```markdown
- Three a day — log your morning from 12, your afternoon from 6, your
  evening from 9, in the person's own timezone — each skipped when that
  part of the day is already logged. The rules are in `lib/reminders.ts`;
  the job is `/api/cron/reminders`.
- **A late run still sends, and each goes out once.** GitHub's scheduler
  delays and drops runs, so a reminder is not tied to its exact hour: the
  morning one may go any time from 12 until 6, the afternoon one from 6
  until 9, the evening one from 9 until midnight — each window ends when
  the next switched-on reminder's hour comes — and nothing about a day is
  sent after its midnight. A run sends only the most recent one
  (`dueReminder`), never an earlier one it missed. `reminder_sends` holds
  one row per person, local date and reminder; the job inserts it before
  sending, so a second run or a second device's subscription cannot repeat
  it, and removes it again if no device was reached. If the table cannot
  be read the job sends nothing and answers 500. "Send a test" writes no
  row.
```

In the bullet that begins "**It must be called every hour.**", change the
sentence "It matches people by their local hour, so a daily schedule
reaches nobody." to "It works from each person's local hour, so a daily
schedule would reach each person with one reminder at most." Leave the
rest of that bullet, including the warning about a second schedule, as it
is.

In the File Structure block, change the comment on `cron/reminders/` to
`# The reminders each person is still owed; called hourly by a GitHub workflow`.

## Rules that apply

- **Branches**: work on `dev`; never touch `main`.
- **Reminders** (CLAUDE.md): the subscription alone decides who; dates and
  hours come from `localClock(now, timezone)`, never the server's clock;
  the job answers with counts and never with who; the workflow is the only
  caller; "Send a test" keeps working.
- **A new table is also something to export and to delete**: the table
  goes into `ACCOUNT_TABLES` in the same change that creates it.
- **Dates**: never round-trip a local date through `toISOString()`. The
  record's `date` is `clock.date` as `localClock` gives it.
- Comments in the house style: plain sentences that say why.

## Do not

- Do not apply the migration, or connect to any database, in any way.
- Do not edit `.github/workflows/reminders.yml` (not even its comments),
  add a `vercel.json`, add any other schedule or outside cron service, or
  add a second caller.
- Do not touch `src/app/api/cron/engagement/`, `src/app/api/push/`,
  `src/lib/push-server.ts` or the Reminders settings screen.
- Do not change any reminder's title, body, tag, url or default time.
- Do not read or write `reminder_enabled`.
- Do not record a skipped (already logged) reminder, and do not add any
  job that deletes old `reminder_sends` rows.
- Do not put a user id, endpoint or date-per-person in the job's answer or
  in its `console` lines.
- Do not try to make the preview deployment send reminders.
- Do not edit `docs/reviews/open.md` or `docs/BUSINESS-CONTEXT.md`.
- Do not push.

## Done when

- The new and adjusted tests in step 5 pass, and between them show: a late
  run sends the missed reminder; a second run in the window does not repeat
  it; only the latest missed one goes out; nothing is sent after midnight;
  an already-logged part of the day is still skipped.
- `npx tsc --noEmit` is clean.
- `npm test` passes, including `src/__tests__/api/account.test.ts`.
- `npm run test:tz` passes.
- `npm run lint` stays at its current count (0 errors, 54 warnings when
  earlier briefs were written; check before starting).
- `npm run build` succeeds.
- `git diff --stat` shows only the seven files under **Files** (and this
  brief, marked built).
- In the app there is nothing new to look at: no screen changes. What the
  owner checks after applying the migration and merging is that all three
  reminders arrive on a normal day, possibly late, each at most once, and
  that **More → Reminders → Send a test** still delivers.

Say in the build report, in plain words: **the migration
`supabase/migrations/20261116_reminder_sends.sql` must be applied to the
real database by the owner before `dev` is merged into `main`.** Until it
is, the job on `main` would answer 500 every hour and send nothing.

## Not decided

Nothing.

## Who should build and review this

- **Build with Sonnet.** Every rule, query, count and test instant is
  written out above; what is left is careful typing and reworking the
  existing tests' expectations.
- **Review with Fable.** It is reminders, a new table, and the export and
  delete list: a mistake here is either silence nobody notices for months
  or the same notification sent over and over, and neither shows on a
  screen.
- **Effort: medium.** The one fiddly part is recomputing the existing
  tests for two timezones, and the brief names the instants.
