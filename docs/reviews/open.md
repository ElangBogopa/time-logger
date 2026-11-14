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

## Review 3 — 2026-11-14 — Fable 5.2 — reviewed cfa9b5e
Verdict: Ready to merge (0 must fix)
- third pass over the token work, first pass over cfa9b5e (plain review voice, new first library source, averages wording), which no earlier review had seen and was read in full
- resolved: runbook-points-at-old-place, business-context-names-a-file, unknown-expiry-counts-as-good (all optional; fix attempt 2 did what it said, docs only)
- recurring: (none)
- still open: (none at must or should; refused-grant-asked-every-request and bad-client-reads-as-outage stay optional and wait for a plan)
- should · brand-voice-plan-not-marked-built · docs/plans/brand-voice-fixes.md · uncommitted: the plan built in cfa9b5e is untracked and has no "BUILT - do not run again" line; second time a built plan was left this way
- should · voice-prompt-contradicts-itself · src/app/api/day-commentary/route.ts:99-100, src/app/api/weekly-review/route.ts:423-426 · REVIEW_VOICE says "do not evaluate the person or the day" while the day prompt still says "use the scores to judge the day" and "70 or more is a strong day", and the weekly one still asks for "what to watch" and a suggestion at temperature 0.7; nobody has read a generated line, so whether the praise is gone is not known
- should · weekly-voice-unpinned · src/lib/prompts.ts:14, src/app/api/weekly-review/route.ts:20 · the comment on REVIEW_VOICE names only PROMPT_VERSION, not COACH_PROMPT_VERSION, so the next voice change would leave old weekly lines in use; no test checks the weekly prompt carries the voice or that either version is in its fingerprint
- optional · guide-keeps-older-claims · src/app/guide/page.tsx:53, :122 · "Active recovery is crucial. Aim for 70% active leisure" and "Second cognitive peak" still read as fact beside the reworded callouts; the plan left them for the citation audit
- optional · wins-name-lives-on-in-code · src/components/review/DayReviewContent.tsx:210 · the block is "What stood out" on screen and WinsSection / Win in code; the plan said not to rename
- checked by hand: no reference to the removed library id anywhere in src; the Harkin 2016 entry against the paper's abstract (138 studies, N = 19,951, small-to-moderate effect, larger when recorded): matches
- uncommitted work: the untracked plan above, and this entry
- checks: tsc clean; npm test 1113 passed, 13 skipped; test:tz 42 passed; lint 0 errors, 54 warnings; build succeeded
- not checked: any generated day or week line against the voice rules (needs the live model); the review screens on a phone; "most of the experiments were about health goals" beyond a secondary summary; the leisure and 90-minute wording against their papers; everything listed as not checked in review 2

## Fix attempt 3 — 2026-11-14 — Sonnet 5.5 — commit "docs: mark the brand voice plan built; name both prompt versions"
- brand-voice-plan-not-marked-built · added the "BUILT - do not run again" line (cfa9b5e) to the plan and committed it · believes: fixed
- weekly-voice-unpinned · the REVIEW_VOICE comment now names both PROMPT_VERSION and COACH_PROMPT_VERSION; new test in weekly-review-cache.test.ts that the weekly system prompt carries "No praise" and no "supportive" or "warm" · believes: partly fixed (nothing tests that either version is in its fingerprint)
- voice-prompt-contradicts-itself · not attempted (not asked for; changes what the model is told, better after real lines are read)
- checks: tsc clean; npm test 1114 passed, 13 skipped; test:tz 42 passed; lint 0 errors, 54 warnings; build succeeded

## Review 4 — 2026-11-14 — Fable 5.2 — reviewed ab830c2
Verdict: Ready to merge (0 must fix)
- fourth pass; looked only for must-fix and for harm done by fix attempt 3 (one comment, one test, one line in a plan). Trying it on a phone is now the better test
- resolved: brand-voice-plan-not-marked-built (the plan is tracked and its third line says BUILT, naming cfa9b5e); weekly-voice-unpinned (the REVIEW_VOICE comment names both version constants, and weekly-review-cache.test.ts checks the weekly system prompt carries the voice; what is left, no test that either version is in its fingerprint, drops to optional)
- recurring: (none)
- still open · should · voice-prompt-contradicts-itself · src/app/api/day-commentary/route.ts:99-100, src/app/api/weekly-review/route.ts:425 and :443 · nobody has attempted it; "use the scores to judge the day", "70 or more is a strong day", "what to watch" and temperature 0.7 still sit beside "do not evaluate the person or the day"; needs real generated lines read before the wording is changed
- new: (none)
- uncommitted work: none besides this entry
- checks: tsc clean; npm test 1114 passed, 13 skipped; test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: any generated day or week line against the voice rules (needs the live model); the review screens, the guide and The Science on a phone; an hour-old sign-in on a real deployment (calendar loads, no banner); Google actually refusing a grant; the tasks picker on a phone

## Review 5 — 2026-11-14 — Fable 5.2 — reviewed fc8affe
Verdict: Not ready (1 must fix)
- fifth pass over the branch, first pass over 164f48e (/do-think) and fc8affe (voice eval, prompts moved to lib/prompts.ts, new day and week wording), which no earlier review had seen and were read in full. For the older work, trying it on a phone is the better test
- resolved: voice-prompt-contradicts-itself (the scores, "judge the day", "strong day", "What to watch" and temperature 0.7 are gone from both prompts; tests pin it; checker breaches in the saved lines went 21 → 0)
- recurring: (none)
- still open: (none at must or should)
- must · false-no-people-line · src/lib/prompts.ts:43-44 · the review says "No time with people was logged" on days and weeks where time with people was logged: in docs/voice-lines/after.md, 13 of the 15 lines whose input has Social or Calls hours say it, some in the sentence after "one hour of social time"; 44 of 48 lines end on it (29 of 48 before this change). It is copied from the example in REVIEW_VOICE, which the plan forbade changing; neither the checker nor a test can see it
- should · voice-eval-plan-not-marked-built · docs/plans/review-voice-eval.md · uncommitted: the plan built in fc8affe is untracked and has no "BUILT - do not run again" line; third time a built plan was left this way
- should · judge-target-missed · docs/voice-lines/after.md · 19 of 48 lines still fail a judge rule against a target of 3, and the two allowed rounds are spent: 17 are the week line passing comment on how much was logged ("only two days had any time logged, indicating limited activity"), 5 are wrong or invented figures. The commit says so; the owner has not yet read the lines, which is what the plan says closes this
- should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · the backfill asks for a day line without hours, so the new prompt has only "Nothing was broken down by category" to write from, and the line is saved for good. Nothing in the app calls the route today, which is why this is not higher
- optional · week-suggestion-says-consider · src/lib/review-voice-check.ts:47 · most week suggestions read "You might consider…" or "You could aim…"; the week checker only catches should, need to and must
- checked by hand: the move to lib/prompts.ts against the old route text; hours from the request are filtered, capped at 19 and 40 characters before reaching the prompt; the day fingerprint takes the category minutes and PROMPT_VERSION and COACH_PROMPT_VERSION are both 3; the eval is outside `npm test`, reads the key from the environment and writes only lines to its report; the saved lines are invented scenarios
- uncommitted work: the untracked plan above, the review 4 entry, and this entry
- checks: tsc clean; npm test 1131 passed, 13 skipped (72 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: `npm run eval:voice` was not run again (it calls the live model; the saved reports were read instead); the judge's own accuracy; the review screens on a phone, including that a day or week line is fetched once and not on every return to the tab; everything listed as not checked in review 4

## Fix attempt 4 — 2026-11-14 — Fable 5.2 — commit "fix: the review no longer says nobody was seen when somebody was"
- false-no-people-line · first attempt. src/lib/prompts.ts: the sentence "No time with people was logged." is gone from REVIEW_VOICE (the rule and the example), which the earlier plan had forbidden touching; the day and week builders now work out from the Social and Calls hours whether there was any, and add the data line "Time with people: none logged." only when there was none; the voice allows the statement only when that line is present. A day with no category breakdown gets no line. PROMPT_VERSION and COACH_PROMPT_VERSION raised to 4. New checker rule false-absence (needs the input's people minutes, which the eval now passes) and new tests in review-people-line.test.ts and review-voice-check.test.ts · believes: fixed, as far as 48 sampled lines can show: `npm run eval:voice` run twice, 0 of the 15 lines whose input has Social or Calls say it (13 of 15 before); docs/voice-lines/after.md is the second run
- tried and dropped: always stating the amount ("Time with people (Social and Calls): 45 minutes, already counted…"). It also gave 0 false lines, but the model read it back as a second total ("Time with people totaled 45 minutes, already included in the calls")
- seen in the new run, not touched: 1 banned-word breach, "The evening mood was great", which is the mood value read back; the week line still comments on how much was logged (judge-target-missed: 19 of 48 lines fail a judge rule, 16 of them total_not_judged)
- not attempted (not asked for): voice-eval-plan-not-marked-built, judge-target-missed, backfill-sends-no-hours, week-suggestion-says-consider
- checks: tsc clean; npm test 1138 passed, 13 skipped (73 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: the review screens on a phone; saved day and week lines being replaced after the version change on a real account
