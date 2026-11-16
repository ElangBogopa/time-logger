# Review log

`open.md` in this folder is the memory of the review routine. A review
starts in a fresh session and knows nothing of the last one; without a
record it finds the same problem again, cannot tell that a fix was already
tried, and goes round for ever.

- `/do-review` reads `open.md`, settles every earlier finding (resolved,
  still open, or recurring), and adds an entry.
- `/do-fix` reads it, fixes what it is asked to, and adds an attempt entry
  saying which model tried what.
- A finding that comes back after an attempt, or whose fix broke
  something, is **recurring**, under the same id: harm from a fix is
  never a new finding. The first attempt is Sonnet (or a stronger first
  try the review names); the second is Fable, once, handed the story
  of the earlier attempts and every example as a test. If Fable fails,
  the finding is **closed**: a must- or should-fix one means re-plan,
  an optional one is left for the owner.
- A finding whose fix would undo what the plan chose on purpose, or go
  past what it was asked, is marked `plan's choice` or
  `past the request` and is never sent to a fix.

`open.md` covers the work on `dev` that is not on `main` yet. When the owner
has `dev` merged into `main`, the session doing the merge renames it to
`merged-YYYY-MM-DD.md` in the same commit, and the next review starts a new
one.

Keep entries short. The repository is public: name files and problems,
never a person, an address, a key or anything from the database.

## Format

```markdown
# Reviews of dev since main at <short commit id>

## Review 1 — 2026-11-14 — Opus 5.5 — reviewed <short commit id>
Verdict: Not ready (1 must fix)
- must · stale-google-token · src/lib/google-token.ts:36 · a failed refresh keeps serving the dead token
- should · no-token-tests · src/lib/google-token.ts · the three routes that depend on it have no test
- optional · duplicate-refresh-request · src/lib/google-token.ts:61
- optional · plan's choice · matcher-needs-with · src/lib/metrics-calc.ts:183 · only a people word after "with" counts · the brief chose "with" only

## Fix attempt 1 — 2026-11-14 — Sonnet 5.5 — commit <short commit id>
- stale-google-token · fall back to calendar_connections when the session token is marked failed · believes: fixed
- no-token-tests · not attempted

## Review 2 — 2026-11-15 — Opus 5.5 — reviewed <short commit id>
Verdict: Not ready (1 must fix, recurring)
- resolved: (none)
- recurring · must · stale-google-token · tried once by Sonnet · the fallback runs, but the banner still reads the old error · next: Fable
- still open · should · no-token-tests

## Fix attempt 2 — 2026-11-15 — Fable 5.2 — commit <short commit id>
- stale-google-token · the banner reads the refreshed state; every example from reviews 1 and 2 kept as a test · believes: fixed

## Review 3 — 2026-11-16 — Opus 5.5 — reviewed <short commit id>
Verdict: Not ready (1 must fix)
- closed · must · stale-google-token · Fable could not fix this · the banner clears, but the calendar now loads twice · re-plan
```

Ids are short, in kebab-case, and name the problem. A finding keeps its id
for as long as it lives, whatever words a later review uses for it.
