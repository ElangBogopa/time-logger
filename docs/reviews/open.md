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
