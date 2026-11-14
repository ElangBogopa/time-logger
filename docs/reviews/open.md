# Reviews of dev since main at 1ecba5e

## Review 1 — 2026-11-14 — Fable 5.2 — reviewed a00cae6
Verdict: Ready to merge (0 must fix)
- should · plan-not-marked-built · docs/plans/stale-google-token.md · uncommitted: the plan built in a5312f3 is untracked and has no "BUILT - do not run again" line, so a merge leaves it behind and /do-build could be pointed at it again
- should · no-route-test-for-token-problem · src/app/api/calendar/events/route.ts:177, src/app/api/tasks/google/route.ts:49 · nothing tests that 'reconnect' answers 401 TOKEN_EXPIRED and 'unavailable' answers 503; swapping them brings the false banner back with every check green
- optional · unknown-expiry-counts-as-good · src/lib/google-token.ts:67 and :93 · a token with no recorded expiry is handed over as it is, and the linked-account path has no 60-second margin, so "never returns a token past its expiry" in CLAUDE.md is slightly stronger than the code
- optional · refused-grant-asked-every-request · src/lib/google-token.ts:70 · a session Google has already refused asks Google again on each calendar or tasks request; the plan lists it as left alone
- optional · bad-client-reads-as-outage · src/lib/google-refresh.ts:46 · a wrong client id or secret answers "Could not reach Google" for ever; intended by the plan, but only the server log says why
- optional · runbook-points-at-old-place · docs/RUNBOOK.md:124 · says to watch refresh failures in auth.ts; the request and its log line now live in google-refresh.ts
- optional · business-context-names-a-file · docs/BUSINESS-CONTEXT.md:99 · ends with a file path although the rule in CLAUDE.md says no file names
- settled from the last log: dead-token-after-failed-refresh (optional, merged-2026-11-14.md) is gone; a failed refresh now returns no token and a reason
- checks: tsc clean; npm test 1104 passed, 13 skipped; test:tz passed; lint 0 errors, 54 warnings; build succeeded
- not checked: an hour-old sign-in on a real deployment (calendar loads, no banner), Google actually refusing a grant, the tasks picker on a phone, whether the Google OAuth app is still in Testing

## Fix attempt 1 — 2026-11-14 — Sonnet 5.5 — the commit titled "test: pin what the calendar and tasks routes answer"
- plan-not-marked-built · added the "BUILT - do not run again" line (a5312f3) to the plan and committed it · believes: fixed
- no-route-test-for-token-problem · new src/__tests__/api/google-token-routes.test.ts: both routes, reconnect → 401 TOKEN_EXPIRED, unavailable → 503 GOOGLE_UNAVAILABLE, neither → NO_CALENDAR · believes: fixed
- optional findings not attempted (not asked for)
- checks: tsc clean; npm test 1110 passed, 13 skipped; test:tz passed; lint 0 errors, 54 warnings; build succeeded

## Review 2 — 2026-11-14 — Fable 5.2 — reviewed 7f16a13
Verdict: Ready to merge (0 must fix)
- resolved: plan-not-marked-built (the plan is tracked and its second line says BUILT, naming a5312f3); no-route-test-for-token-problem (google-token-routes.test.ts pins both routes: reconnect → 401 TOKEN_EXPIRED, unavailable → 503 GOOGLE_UNAVAILABLE, neither → NO_CALENDAR)
- recurring: (none)
- still open: (none at must or should; the five optional findings of review 1 were not asked for and stand as they were)
- new: (none; second pass, looked only for must-fix and for harm done by the fix, which added one test file and one line to a plan)
- uncommitted work: none besides this entry
- checks: tsc clean; npm test 1110 passed, 13 skipped; test:tz 42 passed; lint 0 errors, 54 warnings; build succeeded
- not checked: an hour-old sign-in on a real deployment (calendar loads, no banner), Google actually refusing a grant, the tasks picker on a phone, whether the Google OAuth app is still in Testing

## Fix attempt 2 — 2026-11-14 — Sonnet 5.5 — commit "docs: settle three optional review findings"
- runbook-points-at-old-place · RUNBOOK.md now points at the "Refresh failed" log line in google-refresh.ts and says invalid_grant means refused, anything else means unreachable · believes: fixed
- business-context-names-a-file · removed the closing GO-TO-MARKET.md line from BUSINESS-CONTEXT.md · believes: fixed
- unknown-expiry-counts-as-good · softened the CLAUDE.md sentence to say what the code does (60s margin on the sign-in token, no-expiry token trusted); code not changed · believes: fixed (as a wording fix)
- refused-grant-asked-every-request, bad-client-reads-as-outage · not attempted: behaviour changes the plan left alone on purpose; need /do-plan on Opus first
- checks: tsc clean; npm test 1110 passed, 13 skipped; test:tz 42 passed; lint 0 errors, 54 warnings; build succeeded
