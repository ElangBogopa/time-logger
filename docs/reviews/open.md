# Reviews of dev since main at 6eac745

## Review 1 — 2026-11-15 — Opus 5.5 — reviewed 38a4b92
Verdict: Not ready (1 must fix)
- must · retimed-row-never-leaves · src/lib/repeat-session.ts:110,123 · a clashing row retimed past the session's end is logged into the next session, so this session's box keeps offering it, with no way to dismiss
- should · known-category-untested · src/components/QuickLogModal.tsx:442 · nothing tests that an unchanged prefilled name skips /api/categorize and a retyped one does not, nor the page wiring from a clashing row to the add screen
- optional · heading-inside-button · src/app/log/[period]/page.tsx:573 · an h2 inside a button is invalid markup and drops the heading for screen readers
- optional · repeat-rows-memo-deps · src/app/log/[period]/page.tsx:375 · the eslint-disable could go by memoising visibleEntries or passing entries and pendingDeletes in

## Fix attempt 1 — 2026-11-15 — Sonnet 5.5 — commit pending
- retimed-row-never-leaves · retimeAfterClash now takes the session and keeps the copied times when the moved start would fall in a later session (same fallback as past midnight); test added · believes: fixed
- known-category-untested · new test renders the add screen and checks an unchanged prefilled name skips /api/categorize and a retyped one calls it · believes: partly fixed (the page wiring from a clashing row to the add screen is still untested)
- heading-inside-button, repeat-rows-memo-deps · not attempted (optional)

## Review 2 — 2026-11-15 — Opus 5.5 — reviewed e86a6b8
Verdict: Ready to merge (no must fix)
- resolved: retimed-row-never-leaves, known-category-untested (the page wiring from a clashing row to the add screen is untested; the two halves either side of it are, so left as is)
- optional · clash-fallback-opens-on-clash · src/lib/repeat-session.ts:136 · caused by the fix: when the move would leave the session, the add screen opens on the copied times, which the clash already holds, so saving is refused with "overlaps" until the times are changed

## Fix attempt 2 — 2026-11-15 — Sonnet 5.5 — commit pending
- heading-inside-button · the h2 in the "Same as" button is now a block span with the same eyebrow style · believes: fixed
- repeat-rows-memo-deps · visibleEntries is memoised on entries and pendingDeletes, and repeatRows depends on it; the eslint-disable is gone · believes: fixed
- clash-fallback-opens-on-clash · when the move would leave the session or pass midnight, retimeAfterClash returns null and the add screen opens with no times, instead of the copied times the clash already holds; tests updated · believes: fixed

## Review 3 — 2026-11-15 — Opus 5.5 — reviewed 92a044c
Verdict: Ready to merge (no must fix)
- resolved: heading-inside-button, repeat-rows-memo-deps, clash-fallback-opens-on-clash (saving is no longer refused for the copied times)
- should · clash-fallback-default-times · src/lib/repeat-session.ts:125-130, src/components/QuickLogModal.tsx:313-340 · caused by the fix: "opens without times" is untrue. A null range gets the add screen's defaults, 09:00–10:00 on a past day and last entry's end to now today, so these times can fall in another session. Saved unchanged, the activity is logged there and this session keeps offering the row. The comment and the fix log say otherwise

## Fix attempt 3 — 2026-11-15 — Sonnet 5.5 — commit pending
- clash-fallback-default-times · the add screen gets a `blankTimes` prop; when `retimeAfterClash` returns null the page passes it, so the screen opens with both times empty (save stays disabled until chosen) instead of its 09:00–10:00 or last-entry-to-now defaults; comment corrected; test added · believes: fixed

## Review 4 — 2026-11-15 — Opus 5.5 — reviewed fbffa0e
Verdict: Ready to merge (no must fix)
- resolved: clash-fallback-default-times (blankTimes is set only when retimeAfterClash returns null, is cleared with the prefill when the sheet closes, and the add screen opens on "Set time" with save disabled until a range is confirmed; no harm found to the drag, gap-row or add-button paths)
- fourth pass: trying it on a phone is now the better test

## Review 5 — 2026-11-15 — Opus 5.5 — reviewed d222814
Verdict: Ready to merge (no must fix)
- first pass on d222814 ("Nothing to log" answer and Undo); earlier findings all resolved, none reopened
- should · answered-row-untested · src/app/page.tsx:243-267, src/hooks/useSessionData.ts:44-64 · nothing tests the Today row's "Nothing to log" words and tick, nor setCachedCompletion / removeCachedCompletion handing the answer to Today without a flash; only buildSessionInfos and the session screen are tested
- optional · done-skips-cache · src/app/log/[period]/page.tsx:386-396 · handleDone does not write its row to the cache as handleSkip now does, so Today briefly shows "Not wrapped up" after Done until its refetch lands
- fifth review of this branch: trying it on a phone is now the better test

## Fix attempt 4 — 2026-11-15 — Sonnet 5.5 — commit pending
- answered-row-untested · two test files: the Today page row for a skipped, empty session says "Nothing to log" with the Done tick (and an unanswered row has neither); setCachedCompletion / removeCachedCompletion are checked through the real hook, including that Today re-mounts with the answer and no spinner · believes: fixed
- done-skips-cache · not attempted (optional, not asked for)

## Review 6 — 2026-11-15 — Opus 5.5 — reviewed e80f068
Verdict: Ready to merge (no must fix)
- resolved: answered-row-untested (the Today test renders the real page and fails if the "Nothing to log" words or the tick go; the cache test goes through the real hook and checks the re-mount shows the answer with no spinner)
- no harm from the fix: e80f068 adds only tests and the log; no app code changed
- done-skips-cache stays optional and open
- sixth review of this branch: trying it on a phone is now the better test

## Fix attempt 5 — 2026-11-15 — Sonnet 5.5 — commit pending
- done-skips-cache · handleDone now hands its saved row to the completion cache as handleSkip does, only after the save succeeds; test added (seeds the cache through the real hook, fails without the change) · believes: fixed

## Review 7 — 2026-11-15 — Opus 5.5 — reviewed d9d7a3a
Verdict: Ready to merge (no must fix)
- resolved: done-skips-cache (handleDone writes the saved row with setCachedCompletion only after the upsert returns, as handleSkip does; the new test fails with that line removed)
- no harm from the fix: the POST route returns the full row via .select().single(); a failed save still writes nothing to the cache; setCachedCompletion does nothing for a date Today has not fetched
- seventh review of this branch: trying it on a phone is now the better test

## Review 8 — 2026-11-15 — Opus 5.5 — reviewed 97619a5
Verdict: Ready to merge (no must fix)
- first pass on 97619a5 (goals removed; Google Tasks import on the Plan tab); earlier findings all resolved, none reopened
- checked as the plan asked: user_goals still in ACCOUNT_TABLES and account-data.ts untouched; set-up check asks for goals only without the flag, and a failed lookup leaves setup hidden; nothing left links to /goal/ or calls the two removed routes; no migration
- optional · import-failure-silent · src/app/calendar/page.tsx:630-650 · a POST that answers not-ok is not checked, so a failed import closes the picker with fewer chips and no word (addTask does the same)
- optional · stale-goal-comments · src/lib/goals.ts:47, src/__tests__/plan-google-tasks.test.tsx:129-132 · invalidateGoals still says "after a goal is created or removed"; the new test copies a note about fixed dates it never had
- optional · unused-existing-task-count · src/components/GoogleTasksPicker.tsx:22,25 · the prop is now passed by nobody and was never read
- eighth review of this branch: trying it on a phone is now the better test

## Fix attempt 6 — 2026-11-15 — Sonnet 5.5 — commit pending
- import-failure-silent · both the Google Tasks import and addTask now check each POST's `ok`; a failure shows an error toast (sonner, since the calendar page's own toast state is never rendered); test added · believes: fixed
- stale-goal-comments · invalidateGoals comment now says what it does; the test file's note about fixed dates replaced with a one-line true one (the cited lines were at the top of the file) · believes: fixed
- unused-existing-task-count · prop removed from GoogleTasksPicker · believes: fixed
