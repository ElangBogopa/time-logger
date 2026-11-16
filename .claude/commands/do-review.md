- **Earlier findings**, only if there were any: resolved (ids, one line),
  still open, recurring — each with who tried and "next: Fable" — and
  closed.
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

1. Read the brief this work was built from: the one the arguments name,
   or else every file under `docs/plans/` that
   `git diff --name-only origin/main...dev` lists. Note what it chose on
   purpose (its Goal, its decisions, "Do not") and what it was asked to
   do. Section 4 needs it.
2. Run `git fetch origin`. Read the whole of `git diff origin/main...dev`
   (committed), then `git status --short` and `git diff HEAD` (not yet
   committed). Say which findings are in uncommitted work.
3. Look for, in this order: bugs and wrong behaviour; anything that could
   lose or expose a person's data; breaks of the rules in CLAUDE.md; missing
   tests for new behaviour; documents and plans that say something untrue.
4. Run `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run lint`
   and `npm run build`.

## 3. Settle every earlier finding

For every finding in the log, of any group — must, should or optional —
that is not already resolved, closed or marked (section 4), decide by
looking at the code, not at what a fix claimed:
- **Resolved** — the problem is gone, and the fix did no harm.
- **Still open** — nobody has attempted it.
- **Recurring** — a fix was attempted and the problem is still there,
  moved somewhere else, or the fix broke something. Whether a problem is
  "the same one" is your judgment; match on what goes wrong, not on
  wording. **Anything a fix broke is the finding that fix was for,
  continuing, under its id** — never a new finding "caused by fix".
  Say on the line what it broke, with the examples. If the harm is worse
  than the finding, raise the finding's group to match. If one attempt
  covered several ids, give the harm to the one whose change caused it,
  from the commit's diff.
- **Closed** — Fable attempted it (first or second try) and it is still
  there or did harm, or Fable answered that it cannot be done well.
  It is never attempted again.

Who tries a recurring finding next, from the attempts the log records:
- attempted once by Sonnet, Haiku or Opus → **next: Fable**, once, handed
  the story (`/do-fix` says what that is);
- attempted by Fable → **closed**. A closed must- or should-fix finding
  means the plan or the approach is wrong: say what to rethink and
  recommend `/do-plan`. A closed optional finding reads "Fable could not
  fix this" and is left for the owner.

There is no Opus step after a failure and no second Fable attempt. If
you think a recurring finding is not worth another round, say so on its
line — it goes to Fable with the story — but the line still says
`next: Fable`. Only Fable's own attempt ends a finding's chase.

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

Then mark it if it is not a flaw to chase:
- **plan's choice** — fixing it would undo something the brief chose on
  purpose. Say what the brief chose.
- **past the request** — fixing it would go beyond what the brief was
  asked to do.
A marked finding is never sent to a fix; it is the owner's to decide.
Mark only what the brief plainly settles or plainly leaves out; a flaw
in how the brief's choice was built is not the brief's choice.

A new finding gets its first attempt from Sonnet. If the fix needs
judgment Sonnet is unlikely to bring — a tangle where the obvious fix
trades one error for another — name a stronger first try on its line:
`first try: Opus` or `first try: Fable`.

**On a second or later pass, be narrower.** Report new findings only if
they are must-fix. What a fix broke is not new: it is the finding the
fix was for, recurring (section 3). Do not go looking for fresh
should-fix or optional items in work an earlier pass already covered:
that is how a review never ends. If this is the third pass or more, say so and
say that trying the change on a phone is now the better test.

## 5. Write the log entry, then reply

Append one entry to `docs/reviews/open.md` (create it from the template in
`docs/reviews/README.md` if missing). Keep it short: one line per finding.
Line shapes (`docs/reviews/README.md` has an example):
- `- <group> · <id> · <file:line> · <what goes wrong>` — add
  ` · first try: Opus` or ` · first try: Fable` where section 4 says;
- `- <group> · plan's choice · <id> · <file:line> · <what> · the brief chose <what>`,
  and likewise `past the request`;
- `- still open · <group> · <id>`;
- `- recurring · <group> · <id> · tried once by <model> · <what is still wrong, or what the fix broke, with examples> · next: Fable`;
- `- closed · <group> · <id> · Fable could not fix this · <what is still wrong, or Fable's reason>`;
- `- resolved: <ids>`.

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
- **Not chased**: each finding marked plan's choice or past the request,
  one line, for the owner to decide. "None." if none.
- **Checks**: the result of each command.
- **Not checked**: what this review did not cover.
- **Next step**, one line, following the ladder: `/do-fix <ids>` on
  Sonnet (or the first try a line names) for findings not yet
  attempted, and `/do-fix <ids>` on Fable for recurring ones —
  must and should first, then optional, saying which are optional;
  `/do-plan` when a must- or should-fix finding is closed; or "push
  and try it on a phone", or "ready for the owner to say merge". Never
  Opus for a second attempt. Marked findings are named as the owner's,
  not as something to fix. The owner chooses whether to run any of it.

Do not fix anything and do not merge. Merging `dev` into `main` happens only
when the owner says so.
