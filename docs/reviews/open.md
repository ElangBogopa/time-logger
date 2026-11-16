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
