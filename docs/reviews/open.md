# Reviews of dev since main at d351771

## Review 1 — 2026-11-16 — Opus 5.5 — reviewed 7100afc
Verdict: Ready to merge (0 must fix)
- optional · matcher-needs-with · src/lib/metrics-calc.ts:183 · "Family dinner", "Dinner at mom's", "Visited grandma", "Hangout with the boys" do not count; only a people word after "with" does (as the plan decided)
- optional · matcher-work-false-hits · src/lib/metrics-calc.ts:183 · "Call with Family Services", "Meeting with the family law firm" count toward Heart; rare
- optional · eval-scenario-hides-heart · docs/voice-lines/after.md:362 · the friends-in-leisure header does not show its 6h of Heart, so it reads like a no-friends week
- optional · faith-row-unlabelled · src/components/MetricDetailSheet.tsx:76 · the Heart sheet shows Faith minutes under the raw key "faith" (older than this change, next to the line it added)

## Fix attempt 1 — 2026-11-16 — Sonnet 5.5 — commit pending
- matcher-needs-with · a people word now also counts after "at", "visit(ed)", "saw", and leading an occasion ("Family dinner", "Friends night"); "boys/girls/lads" added · believes: fixed
- matcher-work-false-hits · a people word followed by services, law, court, office, firm and similar is not company · believes: fixed
- eval-scenario-hides-heart · the eval's scenario header prints the Heart hours when set; the stored header in after.md patched by hand, lines not regenerated · believes: fixed
- faith-row-unlabelled · Heart sheet labels the faith row "Faith" · believes: fixed

## Review 2 — 2026-11-16 — Opus 5.5 — reviewed 83c608d
Verdict: Ready to merge (0 must fix)
- resolved: matcher-needs-with, matcher-work-false-hits, eval-scenario-hides-heart, faith-row-unlabelled
- optional · company-veto-too-wide · src/lib/metrics-calc.ts:215 · caused by fix: "planning"/"practice" after a people word veto it, so "Dinner with friends planning the trip" no longer counts (it did before)
- optional · at-school-counts · src/lib/metrics-calc.ts:228 · caused by fix: "at" as a visit word makes "Parent-teacher meeting at the kids school", "Coffee at Friends cafe" count toward Heart

## Fix attempt 2 — 2026-11-16 — Sonnet 5.5 — commit pending
- company-veto-too-wide · "planning" and "practice" removed from the general veto; they veto only after "family" ("Family planning clinic") · believes: fixed
- at-school-counts · "at" counts as a visit only at someone's ("at mom's"), at their house/home/place, or as the last words; "at the kids school", "at Friends cafe" no longer count; tests added for both · believes: fixed

## Review 3 — 2026-11-16 — Opus 5.5 — reviewed 750796f
Verdict: Ready to merge (0 must fix) — third pass; trying it on a phone is now the better test
- resolved: company-veto-too-wide ("Dinner with friends planning the trip" counts again; "family planning clinic" still does not)
- optional · at-school-counts · src/lib/metrics-calc.ts:243 · recurring after one Sonnet attempt (optional, so no escalation): an apostrophe still makes it count: "Parent-teacher meeting at the kids' school", "Pickup at my son's school", "Coffee at friends' cafe"
- optional · at-visit-too-narrow · src/lib/metrics-calc.ts:243 · caused by fix: "Dinner at mom and dad's", "Sunday lunch at my parents then nap", "Dinner at grandma tonight" no longer count (they did at 83c608d)

## Fix attempt 3 — 2026-11-16 — Opus 5.5 — commit pending
- at-school-counts · after "at <people>" the next word decides, not the apostrophe: a place ("school", "cafe", "daycare") makes it not count; tests for "kids' school", "my son's school", "friends' cafe", "daughter's daycare" · believes: fixed
- at-visit-too-narrow · "at" counts when the people are followed by nothing, a home word, an occasion, a stop word ("then", "for") or a time word ("tonight"), and "mom and dad's" is read as one group; tests for the three reviewed examples plus "my parents' house", "mom's for her birthday" · believes: fixed (a place word not in the lists, e.g. "at grandma's cottage", now does not count)

## Review 4 — 2026-11-16 — Opus 5.5 — reviewed d397483
Verdict: Ready to merge (0 must fix) — fourth pass; trying it on a phone is now the better test
- resolved: at-school-counts ("kids' school", "my son's school", "friends' cafe" no longer count)
- optional · at-visit-too-narrow · src/lib/metrics-calc.ts:202 · recurring after one Opus attempt, moved: the three reviewed examples count, but the allow-list of what may follow "at <people>" now drops any unlisted word, not only places: "Dinner at mom's 7pm", "Dinner at mom's again", "Dinner at mom's - fun", "Dinner at grandma's 🎉", "Lunch at my brother's new place", "BBQ at uncle's backyard" (all counted at 750796f). Three rounds have traded one side for the other; leave it, or turn the allow-list into a short deny-list of place words

## Fix attempt 4 — 2026-11-16 — Fable 5.2 — commit pending
- at-visit-too-narrow · the allow-list of what may follow "at <people>" is gone; it is a visit unless a venue word (school, daycare, cafe, club, office, work, shop, class, practice and the like, `VENUE_WORDS`) is among the next three words before the phrase ends; "at a friend's" is read too; the test file now holds every example from all four reviews plus about twenty new ones on each side · believes: fixed for the reviewed examples. Still wrong, by design of a word list: a venue not on the list counts ("Talk at parents evening", "Sunday at the kids playground"); a relative's own venue does not ("Lunch at my cousin's restaurant"); "to grandma's", "Mom's for dinner", "Had the boys over" have no "at" or "with" and do not count

## Review 5 — 2026-11-16 — Opus 5.5 — reviewed 9e3a55f
Verdict: Ready to merge (0 must fix) — fifth pass; trying it on a phone is now the better test
- resolved: at-visit-too-narrow (every example from reviews 3 and 4 counts; school, cafe and club examples still do not)
- optional · at-a-public-place · src/lib/metrics-calc.ts:190 · caused by fix: "a" as a determiner opens "at a <people>" to public places off the venue list: "Volunteered at a kids camp", "Speaker at a family conference", "Shift at a children's charity" now count (did not at d397483); a known cost of the deny-list, not worth another round

## Review 6 — 2026-11-16 — Opus 5.5 — reviewed aaa10b6
Verdict: Ready to merge (0 must fix) — first pass on aaa10b6 (brief docs/plans/fable-before-giving-up.md), sixth on this dev; earlier findings left as they were
- should · review-command-edit-misplaced · .claude/commands/do-review.md:1 · step 2d's new "Earlier findings" reply text was put above the front matter instead of replacing the bullet at :120: the `---` block no longer parses (the command's description now reads "- **Earlier findings**…", argument-hint lost), and the reply list still asks for the old wording, without "closed"
- should · push-rule-says-closed-pushes · CLAUDE.md:18 · "pushes dev when every finding it chases … fixed or closed" reads as if a closed must- or should-fix finding still pushes; do-all.md stops unpushed then (docs/FLOW.md:29 and :118 say the same; its later paragraph corrects it, CLAUDE.md does not). The brief's rule 5 says it stops, so aligning the words undoes nothing
- optional · do-fix-skips-closing-review · .claude/commands/do-fix.md:54 · when Fable answers "cannot be done well" (log only), step 8 says "push and try it on a phone", so by hand no review closes the finding and it still reads next: Fable
- optional · plan's choice · do-all-description-stale · .claude/commands/do-all.md:2 · the front matter still says "until nothing that should be fixed is left", optional findings are chased now · the brief chose to keep the start of do-all.md word for word

## Fix attempt 5 — 2026-11-16 — Sonnet 5.5 — commit pending
- review-command-edit-misplaced · the stray "Earlier findings" lines removed from above the front matter of do-review.md and put in place of the old bullet in the reply list, now with "closed" · believes: fixed
- push-rule-says-closed-pushes · CLAUDE.md and docs/FLOW.md (both places) now say fixed, or closed and only optional; a closed must or should stops the run unpushed · believes: fixed
- do-fix-skips-closing-review · do-fix.md step 8 now sends a log-only "cannot be done well" answer to a new session and `/do-review`, not "try it on a phone" · believes: fixed
- do-all-description-stale · not attempted (plan's choice)

## Review 7 — 2026-11-16 — Opus 5.5 — reviewed 2b02db0
Verdict: Ready to merge (0 must fix) — second pass on the brief docs/plans/fable-before-giving-up.md, seventh on this dev; trying it on a phone is now the better test
- resolved: review-command-edit-misplaced (front matter parses again; the reply bullet at do-review.md:117 has the brief's wording, with "closed"), push-rule-says-closed-pushes (CLAUDE.md:17 and docs/FLOW.md:29, :118 say a closed must or should stops unpushed, as do-all.md:164 does), do-fix-skips-closing-review (do-fix.md:55 sends a log-only answer to `/do-review`)

## Review 8 — 2026-11-16 — Opus 5.5 — reviewed c27d97c
Verdict: Ready to merge (0 must fix) — first pass on c27d97c (brief docs/plans/session-gaps-from-start.md), eighth on this dev; earlier findings left as they were
- should · zero-length-event-runs-to-midnight · src/lib/gaps.ts:76 · a timed calendar event whose end equals its start (Google allows it; the events route also falls back to the start when an event has no end) now counts as busy until 24:00 instead of being dropped, so every row after it vanishes, in the Morning too (event 09:00–09:00, entry 08:00–08:30, now 11:00: was 08:30–11:00, now 08:30–09:00); the brief says "at or before", but only an end before the start (or at 00:00) is the midnight case it meant; should, not must, because such events are rare
- should · failed-fetch-offers-whole-session · src/app/log/[period]/page.tsx:178 · with no cache and a failed fetch (offline), isLoading ends with no entries, so an Afternoon or Evening offers "12:00 PM – now" over time that may be logged; the screen already says "Nothing logged yet" then, which is why this is not must
- should · stale-empty-session-comment · src/lib/gaps.ts:85 · the comment still says an empty session is not a gap and the add button is the answer; true now only for the Morning
- should · no-event-midnight-test · src/__tests__/gaps.test.ts · the end-before-start rule for calendar events (gaps.ts:76) has no test; only entries are tested
- optional · plan's choice · long-event-from-before-flex-range · src/app/log/[period]/page.tsx:300 · an event starting before 10:00 that runs into the Afternoon (08:00–14:00) is not passed, so 12:00–14:00 is offered · the brief chose to keep the session's events filtered by start hour

## Fix attempt 6 — 2026-11-16 — Sonnet 5.5 — commit pending
- zero-length-event-runs-to-midnight · an event whose end equals its start is skipped; only an end before the start (or 00:00) runs to midnight · believes: fixed
- failed-fetch-offers-whole-session · the session screen tracks whether this date's entries are known (cache or a successful fetch); with no cache and a failed fetch it offers no gaps · believes: fixed
- stale-empty-session-comment · the comment in gaps.ts now says only the Morning offers nothing when empty · believes: fixed
- no-event-midnight-test · a test covers a zero-length event, an end before the start and an end at 00:00 · believes: fixed
- long-event-from-before-flex-range · not attempted (plan's choice)

## Review 9 — 2026-11-16 — Opus 5.5 — reviewed c8a5510
Verdict: Ready to merge (0 must fix) — second pass on the brief docs/plans/session-gaps-from-start.md, ninth on this dev; trying it on a phone is now the better test
- resolved: zero-length-event-runs-to-midnight (gaps.ts:78 skips end == start; 09:00–09:00 with 08:00–08:30 at 11:00 gives 08:30–11:00 again; 20:00–01:00 and 20:00–00:00 still run to midnight), failed-fetch-offers-whole-session (page.tsx:121, :374 — no cache and a failed fetch leaves `entriesKnown` false, so no rows; a cached list still counts as known), stale-empty-session-comment (gaps.ts:88), no-event-midnight-test (gaps.test.ts:193 covers zero-length, past-midnight and 00:00 events)

## Review 10 — 2026-11-16 — Opus 5.5 — reviewed f10c681
Verdict: Not ready (1 must fix) — first pass on f10c681 (brief docs/plans/gap-end-and-end-picker.md), tenth on this dev; earlier findings left as they were
- must · edit-picker-seconds · src/components/TimeEntryModal.tsx:88 · the edit form hands the picker the stored times as the database returns them ("06:00:00", as /api/entries passes rows through), which are never in the slot lists: the Start column opens at 12:00 AM, End opens an hour after the start instead of at the held end (an 06:00–08:30 entry opens at 7:00), and neither column highlights anything (TimeRangePicker.tsx:42, :68); the test (entry-edit-times.test.tsx) uses "06:00", so it cannot see it; trim to HH:MM where the modal sets and resets its times (:88, :267), and test with "06:00:00"
- optional · plan's choice · edit-times-cannot-be-cleared · src/components/TimeEntryModal.tsx:418 · the native fields could be emptied to make an entry duration-only; the picker can set times but never clear them · the brief chose to replace the edit form's native fields with TimeRangePicker

## Fix attempt 7 — 2026-11-16 — Sonnet 5.5 — commit pending
- edit-picker-seconds · the edit form trims stored times to HH:MM where it sets and resets them (`hhmm` in TimeEntryModal.tsx); a test with "06:00:00" / "08:30:00" checks the End column opens on 8:30 · believes: fixed
- edit-times-cannot-be-cleared · not attempted (plan's choice)

## Review 11 — 2026-11-16 — Opus 5.5 — reviewed 6b86bfc
Verdict: Ready to merge (0 must fix) — second pass on the brief docs/plans/gap-end-and-end-picker.md, eleventh on this dev; trying it on a phone is now the better test
- resolved: edit-picker-seconds (TimeEntryModal.tsx:74, :91, :270 trim to HH:MM on open and on cancel; "06:00:00"–"08:30:00" opens End on 8:30 and highlights it; the save now writes "06:00", which the time column takes; the new test fails without the trim, since an off-grid end would scroll to 7:00)

## Review 12 — 2026-11-16 — Fable 5.2 — reviewed 94b2665
Verdict: Not ready (1 must fix) — first pass on 94b2665 (brief docs/plans/entries-across-midnight.md), twelfth on this dev; earlier findings left as they were
- must · summary-popup-drops-overnight-sleep · src/components/PeriodSummaryPopup.tsx:246 · the popup filters the entries it is handed again, by the raw start hour, so a night logged as 23:00–07:00 (a Morning entry everywhere else) is missing from the Morning summary: sleep and breakfast read "1 activity logged", and the total, the breakdown and the longest activity leave the sleep out; the page already passes the session's entries (`getEntriesForPeriod`), so drop the second filter or use `onDayTimes` (src/app/api/weekly-review/route.ts:309 buckets by the raw hour too, with little effect)
- must · plan's choice · crossing-event-stays-unconfirmed · src/lib/calendar-match.ts:32 · a calendar event that runs past midnight (22:00–01:00) now confirms, as two entries, but `isEventLogged` never matches an event whose end is before its start, so it is still offered on the session screen, in Next up and on Plan, and each further confirm adds another pair (the sheet's own overlap check finds nothing either, GhostEntryModal.tsx:137); before this change the confirm failed outright · the brief chose "Do not change calendar-match.ts" and to leave GhostEntryModal's overlap check as it is
- should · edit-splits-wake-day-row-forward · src/app/api/entries/[id]/route.ts:71 · when the times of a stored one-piece night change and it is no longer a sleep (category changed by hand earlier, or reworded in the same save), the split starts from the row's date as if that were the evening: 23:00–07:00 dated Tuesday (Monday night) edited to end 06:30 becomes Tuesday 23:00–24:00 and Wednesday 00:00–06:30, a day late; a wake-day row's evening is the day before; should, not must, because it needs a night whose category was moved off sleep · first try: Opus
- should · overnight-ui-untested · src/hooks/useEntryAdjustment.ts:89 · nothing tests that an overnight entry cannot be dragged (a drag would write the clipped times back), the edit form's `overnight_sleep` hint and its refusal to save when the categoriser fails (TimeEntryModal.tsx:178), `blocksForGlance` and the timeline placing by `onDayTimes`, or `useOvernightSpill`
- should · plan's choice · calendar-sleep-lands-a-night-early · src/components/GhostEntryModal.tsx:161 · a sleep confirmed from a calendar event or ticked "Did it" from a plan (NextUp.tsx:157, log/[period]/page.tsx:347) is saved on the event's start date, which the majority rule reads as the night before: Monday 23:00–07:00 becomes Sunday night, counted on Monday; should, not must, because it needs a sleep event in the calendar · the brief chose that confirming and NextUp "get the rule from the server and nothing more"
- should · past the request · sheet-says-plan-for-last-nights-sleep · src/components/QuickLogModal.tsx:812 · typing last night's sleep as 11 PM–7 AM in the morning shows "Plan Ahead", "What are you planning to do?" and "Plan it", then saves it confirmed (correctly); should, not must, because what is saved is right · the brief asked for a branch in handleSubmit and one new view, and to keep everything else as it is
- should · past the request · undo-leaves-second-piece · src/components/NextUp.tsx:178 · "Did it" or "Confirm" on a plan or event that crosses midnight writes two entries and Undo deletes only the first, so tomorrow's 00:00 piece stays; rare · the brief chose that the single form returns the first row only and that NextUp gets nothing more
- optional · confirm-toast-counts-pieces · src/app/log/[period]/page.tsx:360 · confirming one event that crosses midnight says "Confirmed 2 calendar events" (it counts rows, not events), which also gives the split away
- optional · plan's choice · session-total-clips-overnight · src/lib/session-utils.ts:99 · the Morning's total counts 7h for an 8h night (the part on the day) beside an entry that reads 8h · the brief chose `splitEntryByPeriod` from `onDayTimes`
- optional · plan's choice · edit-categorises-on-every-save · src/components/TimeEntryModal.tsx:178 · a planned overnight entry is sent to the categoriser on every edit, also one that leaves the times alone (the server then ignores the hint), and a failed call blocks that save · the brief chose the condition "crosses midnight and no category"
- optional · plan's choice · early-sleep-plan-reads-ready · src/lib/types.ts:948 · a planned sleep mostly before midnight (20:00–03:00 on its own date) shows as ready to confirm at once, its end read as that morning · the brief chose not to change `isEntryInFuture`

## Fix attempt 8 — 2026-11-16 — Sonnet 5.5 — commit pending
- summary-popup-drops-overnight-sleep · the popup no longer filters the entries it is handed by the raw start hour; it uses the page's session entries as they are; a test with a 23:00–07:00 night and a breakfast reads "2 activities" (fails without the change) · believes: fixed
- crossing-event-stays-unconfirmed · the owner asked for this one in the conversation, although the log marks it plan's choice; `calendar-match.ts` now reads an event or entry that ends before it starts (or at 00:00) as running to midnight, so the evening piece of a split, or a one-piece sleep, answers the event; the confirm sheet's overlap check uses the same rule (`isEventLogged`), so a second confirm is refused; no link between the two halves; tests in calendar-match.test.ts · believes: fixed (an event is judged by its own day only: if the evening piece alone is deleted and the morning piece stays, it is offered again)
- overnight-ui-untested · new overnight-ui.test.tsx: an overnight entry starts no drag (an ordinary one does), the edit form's `overnight_sleep` hint (true and false) and its refusal to save when the categoriser fails, `blocksForGlance` placing by `onDayTimes` and drawing the spill, `useOvernightSpill` (the three-day request, own date shows nothing, cache first, a failed lookup survived) · believes: fixed (the timeline's own placing by `onDayTimes` is covered through `blocksForGlance` and `onDayTimes` tests, not rendered)
- confirm-toast-counts-pieces · the toast counts the events confirmed, not the rows saved · believes: fixed
- edit-splits-wake-day-row-forward, calendar-sleep-lands-a-night-early, sheet-says-plan-for-last-nights-sleep, undo-leaves-second-piece, session-total-clips-overnight, edit-categorises-on-every-save, early-sleep-plan-reads-ready · not attempted (not asked, or plan's choice / past the request)
