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
