---
description: Review everything waiting on dev, sorted by how much it matters, remembering what earlier reviews found and what was tried.
argument-hint: [optional: what to look at hardest]
---

Review what is waiting to go from `dev` to `main`. Change no code. The only
file you write is the review log, `docs/reviews/open.md`.

Where to look hardest, if the owner said: $ARGUMENTS

## 1. Read the log first

Read `docs/reviews/open.md` if it exists (format in `docs/reviews/README.md`).
It holds every earlier review of this unmerged work and every attempt to
fix what they found. If there is no file, this is the first pass.

## 2. Read the work and run the checks

1. Run `git fetch origin`. Read the whole of `git diff origin/main...dev`
   (committed), then `git status --short` and `git diff HEAD` (not yet
   committed). Say which findings are in uncommitted work.
2. Look for, in this order: bugs and wrong behaviour; anything that could
   lose or expose a person's data; breaks of the rules in CLAUDE.md; missing
   tests for new behaviour; documents and plans that say something untrue.
3. Run `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run lint`
   and `npm run build`.

## 3. Settle every earlier finding

For each must-fix and should-fix finding in the log that is not already
closed, decide by looking at the code, not at what a fix claimed:
- **Resolved** — the problem is gone.
- **Still open** — nobody has attempted it.
- **Recurring** — a fix was attempted and the problem is still there, or
  the fix moved it somewhere else. Whether a problem is "the same one" is
  your judgment; wording differs between reviews, so match on what goes
  wrong, not on phrasing. Keep the finding's original id.

For each recurring finding, recommend who tries next, from the attempts
the log records:
- attempted once by Sonnet (or Haiku) → **Opus**
- attempted once by Opus → **Fable**
- attempted twice or more, or once by Fable → **stop fixing**: the plan or
  the approach is wrong. Say what to rethink and recommend `/do-plan`.

## 4. Sort what is new

Give each new finding a short id in kebab-case that names the problem
(`stale-google-token`, not `finding-3`), and put it in exactly one group:
- **Must fix** — a person using the app would notice, data could be lost
  or exposed, sign-in or a release could break, or a check fails.
- **Should fix** — users would not notice, but a later session would be
  misled or left unprotected: a wrong document, a missing test, a rule in
  CLAUDE.md broken without harm yet.
- **Optional** — taste.
When unsure between two groups, pick the lower and say why in a clause.

**On a second or later pass, be narrower.** Report new findings only if
they are must-fix, or were caused by a fix. Do not go looking for fresh
should-fix or optional items in work an earlier pass already covered: that
is how a review never ends. If this is the third pass or more, say so and
say that trying the change on a phone is now the better test.

## 5. Write the log entry, then reply

Append one entry to `docs/reviews/open.md` (create it from the template in
`docs/reviews/README.md` if missing). Keep it short: one line per finding.

Reply in this order:
- **Verdict**, one line, from the Must fix group alone, counting recurring
  must-fix findings: "Ready to merge" when none remain, else "Not ready"
  and the count. Say which pass this is.
- **Earlier findings**, only if there were any: resolved (ids, one line),
  still open, and recurring — each recurring one with who tried and who
  should try next.
- **Must fix**, most serious first: id, file and line, what would go
  wrong and for whom. "None." if none.
- **Should fix**, briefly. **Optional**, one line each.
- **Checks**: the result of each command.
- **Not checked**: what this review did not cover.
- **Next step**, one line: `/do-fix` with the model to use, or "push and
  try it on a phone", or "ready for the owner to say merge".

Do not fix anything and do not merge. Merging `dev` into `main` happens only
when the owner says so.
