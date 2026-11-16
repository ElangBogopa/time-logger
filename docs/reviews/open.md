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
