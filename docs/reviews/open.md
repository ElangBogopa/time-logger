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
