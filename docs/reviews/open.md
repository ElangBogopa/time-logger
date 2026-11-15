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

## Review 6 — 2026-11-14 — Fable 5.2 — reviewed 2e0edec
Verdict: Not ready (1 must fix)
- sixth pass; looked only for must-fix and for harm done by fix attempt 4 (the voice text, the two prompt builders, one checker rule, two version numbers). Trying it on a phone is now the better test for everything else
- resolved: false-no-people-line (the sentence is gone from the voice, the builders add "Time with people: none logged." only when Social and Calls are both empty, both versions are 4 and both are in their fingerprints; in docs/voice-lines/after.md 0 of the 15 lines whose input has Social or Calls say it, counted again by hand)
- recurring: (none)
- still open · should · voice-eval-plan-not-marked-built · docs/plans/review-voice-eval.md · still untracked, still no "BUILT - do not run again" line
- still open · should · judge-target-missed · docs/voice-lines/after.md · 19 of 48 lines fail a judge rule (16 are the week line and total_not_judged); waits for the owner to read the lines
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged; a day with no breakdown now gets no people line either, so it is no worse
- must · meetings-read-as-no-people · src/lib/prompts.ts:55 · left by the fix: "people" is Social and Calls only, so a day of four hours of meetings is told "Time with people: none logged." and all 3 saved lines for it read "4 hours of meetings and 1 hour and 30 minutes of admin work. There was no time with people logged." Faith is left out too, although Heart counts it (SOCIAL_CATS in metrics-calc.ts:139), so the ring can be full beside a line saying nobody was seen. Needs a decision first: what counts as time with people, or a narrower sentence ("no social time or calls"); the test "counts Social and Calls, and nothing else" pins today's answer
- should · data-label-read-back · src/lib/prompts.ts:65 · caused by the fix: 10 of 48 saved lines end with the data line pasted whole, "Time with people: none logged.", colon and all; true, so not higher, but it reads as a form field and neither the checker nor the judge flags it
- checked by hand: both callers pass the per-category labels the people check matches on (day-summary categoryBreakdown through DayReviewContent, and the weekly route's own breakdown), not the six-bucket ones; the 19-item cap in the day route cannot cut Social or Calls off a real day
- uncommitted work: the untracked plan above, and this entry
- checks: tsc clean; npm test 1138 passed, 13 skipped (73 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: `npm run eval:voice` was not run again (live model; the saved second run was read instead); saved day and week lines being replaced after the version change on a real account; the review screens on a phone; everything listed as not checked in review 5

## Review 7 — 2026-11-14 — Fable 5.2 — reviewed dac322b
Verdict: Ready to merge (0 must fix)
- seventh pass over the branch, first pass over dac322b (friends or family, built from docs/plans/friends-or-family-line.md; the log has no entry for it because it was a build, not a fix), which was read in full. For everything older, trying it on a phone is the better test
- resolved: meetings-read-as-no-people (people are counted from SOCIAL_CATS, so Faith is in and Meetings stay out; the day prompt carries nothing about people; in docs/voice-lines/after.md the meetings day, both faith days and the faith week say nothing false, and the meetings week says "friends or family", never "people"); data-label-read-back (the data now holds a sentence, not a label and a colon; no saved line pastes a label, read by hand as well as by the new checker rule)
- recurring: (none)
- still open · should · voice-eval-plan-not-marked-built · docs/plans/review-voice-eval.md · still untracked, still no "BUILT - do not run again" line; nobody has attempted it
- still open · should · judge-target-missed · docs/voice-lines/after.md · 19 of 60 lines fail a judge rule, all 19 the week line and total_not_judged; waits for the owner to read the lines
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged; still called by nothing
- should · friends-plan-not-marked-built · docs/plans/friends-or-family-line.md · caused by the build: the plan built in dac322b is committed without the "BUILT - do not run again" line; fourth time
- should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · caused by the build: in a finished week with none, the one suggestion is now often "consider scheduling time with friends" (6 of the 12 such saved lines), a nudge the plan did not ask for and the commit names; 2 focus-only lines run to five sentences for the same reason. Owner accepted both on commit; kept here so the next reading of the lines looks at them
- checked by hand: the weekly route ends a week in progress at yesterday, so the current week is always partial and is never told it had none; both versions are 5 and both are in their fingerprints; the checker is used only by the eval and tests, not by a route
- uncommitted work: the untracked voice-eval plan, the review 6 entry, and this entry
- checks: tsc clean; npm test 1144 passed, 13 skipped (73 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: `npm run eval:voice` was not run again (live model; the saved third run was read instead); saved day and week lines being replaced after the version change on a real account; the review screens on a phone; an hour-old sign-in on a real deployment; Google actually refusing a grant; the tasks picker on a phone

## Review 8 — 2026-11-14 — Fable 5.2 — reviewed 4dbe31a
Verdict: Ready to merge (0 must fix)
- eighth pass over the branch, first pass over 4dbe31a (/do-build marks and commits the plan it built; built from docs/plans/mark-plans-built.md, so the log has no fix entry for it), which was read in full: two command and README edits and three plan markers, nothing under src, scripts or CLAUDE.md. For everything older, trying it on a phone is the better test
- resolved: voice-eval-plan-not-marked-built (tracked, line 3 says BUILT, naming fc8affe); friends-plan-not-marked-built (line 3 says BUILT, naming dac322b). Every file in docs/plans is tracked and says BUILT or PARKED in its first four lines, and /do-build now writes the line itself and refuses a marked plan
- recurring: (none)
- still open · should · judge-target-missed · docs/voice-lines/after.md · 19 of 60 lines fail a judge rule, all the week line and total_not_judged; waits for the owner to read the lines
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged; still called by nothing
- still open · should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · unchanged; accepted by the owner on commit, kept for the next reading of the lines
- new: (none; later pass, looked only for must-fix and for harm done by 4dbe31a)
- uncommitted work: the review 6 and 7 entries, and this entry
- checks: tsc clean; npm test 1144 passed, 13 skipped (73 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: the new /do-build step in use (the next build shows it); `npm run eval:voice` was not run again (live model); saved day and week lines being replaced after the version change on a real account; the review screens on a phone; an hour-old sign-in on a real deployment; Google actually refusing a grant; the tasks picker on a phone

## Review 9 — 2026-11-14 — Fable 5.2 — reviewed 817ca6f
Verdict: Ready to merge (0 must fix)
- ninth pass over the branch, first pass over 817ca6f (/do-all; built from docs/plans/do-all.md, so the log has no fix entry for it), which was read in full beside the four commands it drives: one new command file, edits to do-think, FLOW.md, the plans README and CLAUDE.md, nothing under src, scripts or supabase. For everything older, trying it on a phone is the better test
- resolved: (none)
- recurring: (none)
- still open · should · judge-target-missed · docs/voice-lines/after.md · 19 of 60 lines fail a judge rule, all the week line and total_not_judged; waits for the owner to read the lines
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged; still called by nothing
- still open · should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · unchanged; accepted by the owner on commit, kept for the next reading of the lines
- optional · flow-understates-do-all-stops · docs/FLOW.md:32-35 · says /do-all asks "only if the plan had to guess" and stops without pushing in two cases; the command also asks when the working tree holds anything but the review log, and also stops when a build or fix leaves no commit
- optional · unreviewed-build-is-pushed · .claude/commands/do-all.md:94 · a brief that says "no review needed" is pushed to dev straight after the build; the plan named this as a choice, but the CLAUDE.md exception reads as if a review always came first
- optional · round-count-loose · .claude/commands/do-all.md:122 · "a round is one fix followed by one review", yet one round can start a fix helper per model; a conductor could count either way toward the five
- checked by hand: /do-all pushes only `origin dev`, checks the branch first, never forces, and does not push a run that stopped; it never sends a finding from before the run to a fix; the arguments it hands /do-review override the "narrower on a later pass" rule for the new commits only; the model names it passes are ones the helper tool accepts; the plan is tracked and marked BUILT; do-plan, do-build, do-review, do-fix and do-help are unchanged
- uncommitted work: the review 6, 7 and 8 entries, and this entry
- checks: tsc clean; npm test 1144 passed, 13 skipped (73 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: /do-all itself has never been run (its first run is the test: whether helpers follow a command file read from disk, whether the conductor stays silent and counts rounds as meant); `npm run eval:voice` was not run again (live model); saved day and week lines being replaced after the version change on a real account; the review screens on a phone; an hour-old sign-in on a real deployment; Google actually refusing a grant; the tasks picker on a phone

## Review 10 — 2026-11-14 — Opus 5.5 — reviewed 7643111
Verdict: Ready to merge (0 must fix)
- tenth pass over the branch, full first pass over 7643111 (Reminders line while off; built from docs/plans/reminders-off-line.md), read in full: one conditional in src/app/settings/notifications/page.tsx:237, four tests, the plan marked BUILT. For everything older, trying it on a phone is the better test
- resolved: (none)
- recurring: (none)
- still open · should · judge-target-missed · docs/voice-lines/after.md · unchanged
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged
- still open · should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · unchanged
- new must / should: (none). The condition uses the same canSwitch and locked that decide the Turn on button and the dimmed list, so the line and the button cannot disagree; the tests cover off, on, blocked and unsupported
- optional · off-line-flashes-while-loading · src/app/settings/notifications/page.tsx:237 · if the push hook reports isSubscribed false before it has read the subscription, a subscribed device may show "Turn reminders on…" for a moment; the dimmed list and Turn on label already do the same, so not new in kind
- uncommitted work: the review 6 to 9 entries, and this entry
- checks: tsc clean; npm test 1147 passed, 13 skipped (73 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: the screen on a phone (off, on, blocked, iPhone tab); /do-all's own run beyond this review; `npm run eval:voice` (live model)

## Review 11 — 2026-11-14 — Opus 5.5 — reviewed a29afe8
Verdict: Ready to merge (0 must fix)
- eleventh pass over the branch, full first pass over a29afe8 (unused ghost-events hook removed; built from docs/plans/remove-unused-ghost-hook.md), read in full: one deleted hook, one CLAUDE.md bullet, one new test file, the plan marked BUILT. For everything older, trying it on a phone is the better test
- resolved: (none)
- recurring: (none)
- still open · should · judge-target-missed · docs/voice-lines/after.md · unchanged
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged
- still open · should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · unchanged
- new must / should: (none). Nothing under src imports useGhostEvents or ghostInteractionRef; the new Escape test has a passing control, so it does exercise the listener in useTimelineMouseCreate; the CLAUDE.md line matches TimelineView.tsx:208-233 (mouse down or a tap under 10px opens the sheet, no drag)
- optional · ghost-future-drag-comment · src/components/TimelineView.tsx:213 · "In the future, this could integrate with the drag creation hooks" now points at hooks that are gone in spirit; the plan chose to leave it
- uncommitted work: the review 6 to 10 entries, and this entry
- checks: tsc clean; npm test 1149 passed, 13 skipped (74 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: a calendar block tapped and clicked on the preview; Escape mid-drag in a desktop browser; `npm run eval:voice` (live model)

## Review 12 — 2026-11-15 — Opus 5.5 — reviewed c89a00e
Verdict: Ready to merge (0 must fix)
- twelfth pass over the branch, full first pass over c89a00e (/do-all sorts its guesses and always reviews; built from docs/plans/do-all-guesses-and-review.md), read in full beside the whole of do-all.md, FLOW.md and do-plan.md: text in five files and a new plan, nothing under src, scripts or supabase. For everything older, trying it on a phone is the better test
- resolved: unreviewed-build-is-pushed (optional; step 2 now always goes on to a review, on opus when the brief says none is needed, and "Never" forbids a push before one)
- recurring: (none)
- still open · should · judge-target-missed · docs/voice-lines/after.md · unchanged
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged
- still open · should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · unchanged
- still open · optional · flow-understates-do-all-stops · docs/FLOW.md:34-41 · the rewritten sentence still says "only", and still leaves out the stop for a dirty working tree (do-all.md step 0) and for a build or fix with no commit
- new must / should: (none). The four do-all mentions (do-all.md, FLOW.md, plans/README.md, CLAUDE.md) agree that a review always runs and when the run stops for guesses; the plan's grep checks hold; the plan is tracked and marked BUILT; do-build, do-review, do-fix, do-think and do-help are unchanged
- optional · notice-list-catches-scope · .claude/commands/do-all.md:70-71, :78 · "what is in or out of the change" together with "when unsure, put it in the first" covers most choices a planner makes, so runs may still stop about as often as before; only a real run will show
- optional · flow-wording-counted-unnoticed · .claude/commands/do-all.md:74-75 · wording in the command files is listed as something nobody notices, yet when the change is to the flow itself the owner is its only reader; FLOW.md is in neither list
- uncommitted work: the review 6 to 11 entries, and this entry
- checks: tsc clean; npm test 1149 passed, 13 skipped (74 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: /do-all actually run with the new rules (whether a planner sorts its guesses as meant, whether a "no review needed" brief gets its Opus review); `npm run eval:voice` (live model); the app on a phone

## Review 13 — 2026-11-15 — Opus 5.5 — reviewed 0731d3e
Verdict: Not ready (1 must fix)
- thirteenth pass over the branch, full first pass over 0731d3e (Reminders line waits for the device check; built from docs/plans/reminders-line-no-flicker.md), read in full: one condition, one test, the plan marked BUILT. For everything older, trying it on a phone is the better test
- resolved: off-line-flashes-while-loading (optional; the line now waits for push.isLoading)
- recurring: (none)
- still open · should · judge-target-missed · docs/voice-lines/after.md · unchanged
- still open · should · backfill-sends-no-hours · src/app/api/day-review/backfill/route.ts:89 · unchanged
- still open · should · week-suggestion-proposes-friends · src/lib/prompts.ts:199 · unchanged
- must · turn-on-line-needs-granted · src/app/settings/notifications/page.tsx:237 · the build also added `push.permission === 'granted'`, which the plan did not ask for; a device that has never been asked (permission 'prompt', the usual state before the first Turn on) with reminders off now reads "Sent on the hour…" again, undoing 7643111 for most people who would see the line. Fix: drop that clause, as the plan's code shows
- should · no-test-for-prompt-off · src/__tests__/reminders-screen.test.tsx:212 · the off test uses the helper's default permission 'granted', so nothing covers off-and-never-asked; that is why the extra clause passed
- should · commit-message-understates · 0731d3e message · says only isLoading was added and "nothing else changes"; a later session reading it would not look for the permission clause
- optional · ghost-future-drag-comment, flow-understates-do-all-stops, notice-list-catches-scope, flow-wording-counted-unnoticed · unchanged
- uncommitted work: the review 6 to 12 entries, and this entry
- checks: tsc clean; npm test 1150 passed, 13 skipped (74 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: the screen on a phone or browser (first open, never-asked, blocked, iPhone tab); `npm run eval:voice` (live model)

## Fix attempt 5 — 2026-11-15 — Sonnet 5.5 — the commit titled "fix: the Reminders line says to turn on for a device never asked"
- turn-on-line-needs-granted · dropped `&& push.permission === 'granted'` from the line's condition in notifications/page.tsx, so it is now `canSwitch && locked && !push.isLoading` as the plan had it · fixed
- no-test-for-prompt-off · added a reminders-screen test: off with permission 'prompt' and not loading reads "Turn reminders on to choose the times." · fixed (the test would have failed with the granted clause)
- commit-message-understates · 0731d3e's message cannot be changed without rewriting history, so it was left; this commit's message and this entry say that 0731d3e also added a permission clause and that it is now removed · partly fixed (the old message still understates)
- uncommitted work carried in this commit: the review 6 to 13 entries, and this entry
- checks: tsc clean; npm test 1151 passed, 13 skipped (74 suites); test:tz 42 passed in each of 7 timezones; lint 0 errors, 54 warnings; build succeeded
- not checked: the screen on a phone or browser
