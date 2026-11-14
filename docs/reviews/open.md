# Reviews of dev since main at d95c6a7

## Review 1 — 2026-11-14 — Fable 5.2 — reviewed a49ef85
Verdict: Ready to merge (0 must fix)
- optional · dead-token-after-failed-refresh · src/lib/google-token.ts:58 · a failed refresh still hands back the expired token; carried over unchanged from the two routes it replaced
- optional · ids-still-logged-in-calendar-callback · src/app/api/calendar/callback/route.ts:49 · user ids still printed; already listed as item 6 in docs/plans/clerk-migration.md
- not checked: sign-in, calendar, tasks, account deletion and the service worker on a real deployment
