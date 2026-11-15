# Remove goals from the app

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: remove goals from the app; Google Tasks import moves to the Plan tab". It stays as the record of what was asked.

## Goal

Goals repeat what the app is already for and the owner does not use them, so
a person should no longer see goals anywhere: not on Today, not as a page,
not in setup, not in the guide or the privacy page. The Plan tab becomes the
only place to plan. Nothing saved is erased and the database is not changed.

Settled by the owner before this brief was written:

1. **Import from Google Tasks moves to the Plan tab** and keeps working
   there (Google tasks pulled in as tasks for a day). The app keeps asking
   Google for read access to tasks, and the privacy page keeps its "Google
   Calendar and Tasks" section. This is the one addition to the Plan tab.
2. **The plan-completion figures on the goal page are dropped** (today's
   percentage with points per task, the week's average, "priority done",
   "perfect days", the seven-day bars, "N of 7 days planned"). They are
   shown nowhere afterwards. The day review keeps listing the plan's tasks
   exactly as it does now.
3. **Streaks go too**: the streaks card and the "Plan tomorrow" link on
   Today leave with the "Goals" section, and the goal page's streaks leave
   with the page. Streaks are then shown nowhere. Nothing stored is erased.
4. **An older account with a saved goal but no "set up" flag is still
   recognised as set up**, silently. A brand-new account is recognised as
   set up by the flag alone, with no goal.

## Files

### Delete

- `src/components/YourPlan.tsx` — the "Goals" section on Today (heading,
  "Plan tomorrow" link, streaks card, goal rows, "No goals set yet").
- `src/app/api/streaks-productivity/route.ts` — only `YourPlan` and the goal
  page called it.
- `src/app/api/productivity-score/route.ts` — only the goal page called it.
  **Keep `src/lib/productivity-score.ts` untouched**: `/api/day-summary`
  and the day review still use `calculateDailyScore`.
- `src/__tests__/api/goals-delete.test.ts` — tests the `DELETE` handler
  removed below.

### Replace

- `src/app/goal/[id]/page.tsx` — replace the whole file (786 lines) with a
  server component that sends an old link to Today. No `'use client'`:

  ```tsx
  import { redirect } from 'next/navigation'

  /**
   * Goals were removed from the app. An old link or bookmark to a goal
   * lands on Today rather than on an error.
   */
  export default function GoalPage() {
    redirect('/')
  }
  ```

### Change

- `src/app/page.tsx` (Today)
  - Remove `import YourPlan from '@/components/YourPlan'`.
  - Remove the `{/* 5. YOUR PLAN section */}` comment and the
    `<YourPlan key={`goals-${planRefreshKey}`} … />` line under it.
  - In `OnboardingModal`'s `onComplete`: remove the three-line comment
    beginning "Onboarding has just created a goal" and the
    `sessionStorage.removeItem('your-plan-cache')` line.
  - **Keep** `planRefreshKey`, `setPlanRefreshKey` and the
    `setPlanRefreshKey((key) => key + 1)` call: `FirstRunCard` is keyed on
    it. Keep the `router.push(`/calendar?date=${next.planDate}&suggest=1`)`
    line exactly as it is.

- `src/components/OnboardingModal.tsx`
  - In `finish`, delete the whole goal block: from the comment "The goal
    page hangs off this goal, and nothing else creates one." through the
    closing brace of `if (!hasGoal) { … }` (the `GET /api/goals`, the
    `POST /api/goals` and `invalidateGoals()`).
  - Remove `import { invalidateGoals } from '@/lib/goals'`.
  - Everything else in `finish` stays in the same order: `PUT
    /api/preferences` with `{ productivity_target: 80 }`, the `POST
    /api/plans` loop, `startFirstRun()`, `onComplete(...)`. No screen text
    changes.

- `src/hooks/useDashboardState.ts` — the "is this account set up" check.
  Rewrite `checkOnboardingNeeded` so the goal lookup is a fallback only:
  1. `fetch('/api/preferences', { signal })`. If the response is not ok, do
     nothing (as now).
  2. If `preferences.productivity_target != null` → set up. Do **not**
     request goals.
  3. Otherwise `await fetchGoals()`. If it returns one or more goals → set
     up (the older-account fallback). If it returns none →
     `setShowOnboarding(true)`. If it throws → the existing `catch` runs
     and onboarding is **not** shown (a failed lookup must never put a
     set-up account back through setup).
  - Update the comments: the flag is what marks an account as set up; the
    goal lookup exists only for accounts set up before the flag was
    written, because goals are no longer shown or created.
  - `hasCheckedTargets` and the `finally` stay as they are.

- `src/lib/goals.ts` — keep `fetchGoals`, `invalidateGoals` and the `Goal`
  type as they are (the fallback above uses `fetchGoals`; the tests use
  `invalidateGoals` to reset). Rewrite only the header comment: goals are
  no longer shown or created; this reader survives for the set-up fallback
  in `useDashboardState`.

- `src/app/api/goals/route.ts` — keep `GET` unchanged. Remove the `POST`
  and `DELETE` handlers (and the now-unused `NextRequest` import): nothing
  in the app creates or retires a goal any more. Add a short comment above
  `GET` saying why it remains (the set-up fallback) and that `user_goals`
  rows are kept, exported and deleted with the account.

- `src/app/calendar/page.tsx` (the Plan tab) — add Import from Google
  Tasks. Nothing else on this page changes.
  - Import `GoogleTasksPicker from '@/components/GoogleTasksPicker'` and
    add `CheckSquare` to the `lucide-react` import.
  - State: `const [showGoogleTasks, setShowGoogleTasks] = useState(false)`.
  - Handler, next to `addTask`:

    ```ts
    /** Google tasks, pulled in as tasks for the day being planned. */
    const handleImportGoogleTasks = async (titles: string[]) => {
      const wanted = titles.map((t) => t.trim()).filter(Boolean)
      if (wanted.length === 0 || isAddingTask) return
      setIsAddingTask(true)
      try {
        for (const title of wanted) {
          await csrfFetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate, title }),
          })
        }
        // New tasks change what there is to place: any proposal is stale.
        setSuggestions(null)
        setUnplaced([])
        fetchEntriesForDate()
      } catch (err) {
        console.error('Failed to import Google tasks:', err)
      } finally {
        setIsAddingTask(false)
      }
    }
    ```

    One request at a time, in the order picked, so `sort_order` follows the
    order in the picker. No `goal_id` is sent.
  - Button: inside the tray `<section>` (the one rendered when
    `!isPastDay`), directly after the `recurring.length > 0` "You often do"
    block and before the "Suggest times around my calendar" button:

    ```tsx
    <button
      type="button"
      onClick={() => setShowGoogleTasks(true)}
      disabled={isAddingTask}
      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-all duration-150 hover:border-foreground/25 hover:text-foreground active:scale-[0.99] disabled:opacity-50"
    >
      <CheckSquare className="h-4 w-4" />
      Import from Google Tasks
    </button>
    ```

    It is always shown in the tray (today and future days), whether or not
    a calendar is connected — the picker already explains a missing or
    expired connection, as it did on the goal page.
  - Sheet: next to `<SourceSheet … />`:

    ```tsx
    <GoogleTasksPicker
      isOpen={showGoogleTasks}
      onClose={() => setShowGoogleTasks(false)}
      onImport={handleImportGoogleTasks}
    />
    ```
  - Do not change `src/components/GoogleTasksPicker.tsx` or
    `src/app/api/tasks/google/route.ts`.
  - Leave the existing comments that mention the goal page (they record
    why the tray exists) and the `?task=` / `?planId=` handling alone.

- `src/app/privacy/page.tsx`
  - "What you plan" becomes: `<strong>What you plan:</strong> the tasks you
    set for a day and the times you give them.`
  - Leave the "Google Calendar and Tasks" section exactly as it is.
  - Change `updated="12 November 2026"` on `LegalPage` to the date of the
    build, in the same format.

- `src/app/guide/page.tsx` — the footer note. Replace
  "Adapt to your chronotype, life phase, and goals." with
  "Adapt to your chronotype and life phase." The other two lines stay.

- `src/components/AccountSheets.tsx` — two sentences lose the word and
  nothing else:
  - "One .json file: your log, plans, goals, reviews and settings." →
    "One .json file: your log, plans, reviews and settings."
  - "…and everything in it: your log, plans, goals, reviews and settings.
    It cannot be undone." → "…and everything in it: your log, plans,
    reviews and settings. It cannot be undone."

- `src/app/globals.css` — comment only: `"Next up", "Your day", "Goals"` →
  `"Next up", "Your day"`.

- `CLAUDE.md`, Design Principle 10. The first sentence becomes:
  "Planning happens on the Plan tab, which stays free of checkboxes."
  Directly after that sentence add: "Goals were removed from the app:
  nothing shows or creates one, `/goal/<id>` redirects to Today, and the
  saved `user_goals` rows stay — still in `ACCOUNT_TABLES`, so still
  exported and still deleted with the account. `daily_plans.goal_id` is
  left as it is; a task once added under a goal is an ordinary task."
  Change nothing else in CLAUDE.md.

### Tests

- `src/__tests__/onboarding.test.tsx`
  - Remove `jest.mock('@/lib/goals', …)`.
  - In `beforeEach`, the `csrfFetch` mock just returns
    `{ ok: true, json: async () => ({}) }`.
  - Replace the last test ("does not create a second default goal…") with
    two assertions that setup never touches goals: after "Find them a
    time" and after "I'll plan later", `calls().some((c) =>
    String(c.url).startsWith('/api/goals'))` is `false`. The existing
    assertions that `/api/preferences` is `PUT` and that `onComplete` gets
    `{ planDate }` stay — they are the "setup still ends on the first
    plan" check.

- `src/__tests__/today-answered-row.test.tsx` — remove the
  `jest.mock('@/components/YourPlan', …)` line (the module no longer
  exists and the mock would fail to resolve).

- New `src/__tests__/setup-recognised.test.tsx` — `renderHook` on
  `useDashboardState` with `next/navigation` mocked (`useRouter`,
  `useSearchParams: () => new URLSearchParams()`), `global.fetch` mocked by
  URL, and `invalidateGoals()` called in `beforeEach`. Session:
  `{ user: { id: 'u1' } }`, status `'authenticated'`. Wait for
  `hasCheckedTargets` to be `true`, then:
  1. flag set (`productivity_target: 80`) → `showOnboarding` false, and
     `/api/goals` was never requested;
  2. no flag, no goals → `showOnboarding` true (a brand-new account);
  3. no flag, one saved goal → `showOnboarding` false (the older account);
  4. no flag, `/api/goals` answers 500 → `showOnboarding` false.

- New `src/__tests__/plan-google-tasks.test.tsx` — copy the mocks at the
  top of `src/__tests__/plan-tomorrow.test.tsx` (same `TOMORROW`, same
  `global.fetch` for `/api/plans`), and add
  `jest.mock('@/components/GoogleTasksPicker', …)` with a stand-in that
  renders, when `isOpen`, a button "pick two" calling
  `onImport(['Renew passport', 'Book dentist'])`. Then:
  1. the tray shows a button named "Import from Google Tasks";
  2. clicking it, then "pick two", makes exactly two `csrfFetch` calls to
     `/api/plans` with method `POST` and bodies
     `{ date: TOMORROW, title: 'Renew passport' }` and
     `{ date: TOMORROW, title: 'Book dentist' }`, in that order, with no
     `goal_id` key;
  3. `onImport([])` makes no request.

- New `src/__tests__/goal-link.test.ts` — mock `next/navigation` with
  `redirect: jest.fn()`, import the default export of
  `@/app/goal/[id]/page`, call it, and expect `redirect` to have been
  called with `'/'`.

- `src/lib/__tests__/goals.test.ts` stays and must still pass. In its one
  comment that names `YourPlan`, say "two readers mount together" instead.
- `src/__tests__/api/account.test.ts` and `account-data.test.ts` are not
  edited and must still pass: they are the check that saved goals are
  still exported and still deleted.

## Steps

1. `git branch --show-current` — must be `dev`.
2. Run `npm run lint` and note the warning count (54 when this brief was
   written).
3. Plan tab first, so nothing is lost before it has a new home: add the
   import button, handler and picker to `src/app/calendar/page.tsx`; write
   `plan-google-tasks.test.tsx`; run it with `plan-tomorrow.test.tsx` and
   `plan-personal.test.tsx`.
4. Setup: edit `OnboardingModal.tsx` and `onboarding.test.tsx`; edit
   `useDashboardState.ts` and write `setup-recognised.test.tsx`.
5. Today: edit `src/app/page.tsx`, delete `YourPlan.tsx`, fix
   `today-answered-row.test.tsx`.
6. Goal page: replace `src/app/goal/[id]/page.tsx` with the redirect;
   write `goal-link.test.ts`.
7. Routes: delete the two API routes; trim `api/goals/route.ts` to `GET`;
   delete `goals-delete.test.ts`; update the comment in `lib/goals.ts`.
8. Words: privacy page, guide page, `AccountSheets.tsx`, the comment in
   `globals.css`, the comment in `goals.test.ts`.
9. `CLAUDE.md` principle 10.
10. Run every check under "Done when".

## Rules that apply

- **Branches**: work on `dev`; never touch `main`.
- **A new table is also something to export and to delete**: the reverse
  applies here — `user_goals` stays in `ACCOUNT_TABLES` in
  `src/lib/account-data.ts`, in the same position, so it is still exported
  and still cleared.
- **What the app is for**: it never writes to Google. The import only
  reads Google Tasks, as before.
- **Design principle 1** (touch targets 44px+): the new button is
  `min-h-11`.
- **Design principle 2** (muted palette): the new button uses only
  `text-muted-foreground`, `border-border`; no new colour.
- **Design principle 3** (minimal UI, sheets from the bottom): the picker
  is already a `DialogContent` sheet; the new button is a secondary dashed
  row, not a second primary button.
- **Design principle 7** (one scoring system): the dropped completion
  figures and streaks are not replaced by anything.
- **Design principle 8** (no loading flash): Today loses a fetching
  component and gains none; the Plan tab's caching is untouched.
- **Design principle 10**: its first sentence is rewritten by this change,
  as the owner asked.
- **Who is signed in**: no new file imports `next-auth`
  (`session-discipline.test.ts`).
- **AI API calls**: importing tasks makes no categorise call; the existing
  "Suggest times" does that when asked, as now.

## Do not

- Do not write a migration, drop or alter `user_goals`, or touch
  `daily_plans.goal_id`. Do not delete, deactivate or rewrite any saved
  goal row.
- Do not remove `user_goals` from `ACCOUNT_TABLES`, and do not edit
  `src/lib/account-data.ts`, the `/api/account` routes or their tests.
- Do not change `/api/plans` (it keeps accepting `goal_id`), so tasks once
  added under a goal keep showing on the Plan tab and in Next up as
  ordinary tasks.
- Do not change `NextUp.tsx`, `lib/next-up.ts`, the reviews
  (`components/review/*`, `/api/day-summary`, `/api/day-review`,
  `/api/weekly-review`), `lib/metrics-calc.ts`, `lib/productivity-score.ts`
  or anything about the scores.
- Do not change how the Plan tab works beyond the one button, handler and
  sheet described. No de-duplication, no new copy, no reordering.
- Do not build a replacement for goals, for the completion figures or for
  streaks, and do not move the "Plan tomorrow" link elsewhere.
- Do not change `GoogleTasksPicker.tsx`, `/api/tasks/google`, the Google
  scopes in `lib/auth.ts`, or the privacy page's "Google Calendar and
  Tasks" section.
- Do not touch the streak helpers and tests in `lib/types.ts` /
  `types.test.ts`, `ShareableStatsCard.tsx`, or `/api/cron/engagement`.
- Do not reword other uses of the word that are not the goals feature: the
  study title "Does Monitoring Goal Progress Promote Goal Attainment?" and
  its note in `src/lib/library.ts`, and wording produced inside the
  reviews. They are outside the four places the owner named and the
  reviews are not to change.
- Do not edit `docs/BUSINESS-CONTEXT.md` or `docs/reviews/` — those change
  at a merge. Do not push; do not touch `main`.

## Done when

The builder can run:

- `npx tsc --noEmit` — clean.
- `npm test` — all pass, including the four new or rewritten test files
  and the unedited `account.test.ts`, `account-data.test.ts`,
  `session-discipline.test.ts`, `palette-discipline.test.ts`,
  `plan-tomorrow.test.tsx`, `plan-personal.test.tsx`,
  `next-up-component.test.tsx` and `day-review.test.tsx`.
- `npm run test:tz` — passes.
- `npm run lint` — 0 errors and no more warnings than before (54; fewer is
  expected, since deleted files carried some).
- `npm run build` — succeeds, and the route list no longer has
  `/api/streaks-productivity` or `/api/productivity-score`.
- `grep -rn "YourPlan\|your-plan-cache\|streaks-productivity\|api/productivity-score" src`
  — no matches.
- `grep -rn "api/goals" src --include=*.ts --include=*.tsx` — matches only
  `src/lib/goals.ts`, `src/app/api/goals/route.ts` and tests.
- `grep -n -i "goal" src/app/page.tsx src/components/OnboardingModal.tsx src/app/guide/page.tsx src/app/privacy/page.tsx src/components/AccountSheets.tsx`
  — no matches.
- `git diff --stat` shows nothing under `supabase/` and no change to
  `src/lib/account-data.ts`.

To look at in the app (`npm run dev`):

- Today: no "Goals" heading, no "Plan tomorrow" link, no streaks card, no
  "No goals set yet". Next up, the sessions and "Day in review" are where
  they were.
- `/goal/anything` lands on Today, not on an error.
- Plan tab, today or a future day: "Import from Google Tasks" sits in the
  tray; picking two tasks adds two chips to the tray for that day, and
  "Suggest times around my calendar" then places them as usual.
- A task that was added under a goal before this change still shows on the
  Plan tab and in Next up.
- A new account: the four setup screens, "Find them a time", then the Plan
  tab with the proposal already made. Reloading Today does not show setup
  again.
- Guide footer and Privacy → "What Better stores" no longer say "goals".
  Privacy still has "Google Calendar and Tasks".
- More → Export your data: the file still has a `goals` key for an account
  that had one.

## Not decided

nothing

## Who should build and review this

- **Build with Sonnet.** Every edit is named down to the line or the
  sentence, and the one piece of new behaviour (the import handler) is
  written out.
- **Review with Opus.** The change removes a page and two routes and
  touches how an account is recognised as set up; none of it changes
  sign-in, the database's shape, or the export and delete code, so the
  costlier reviewer is not needed. The reviewer should check the set-up
  fallback and that `user_goals` is still in `ACCOUNT_TABLES`.
- **Effort: medium.** Many files, no hard decisions left.
