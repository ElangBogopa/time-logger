---
description: Review everything waiting on dev, sorted by how much it matters, before the owner is asked to merge.
argument-hint: [optional: what to look at hardest]
---

Review what is waiting to go from `dev` to `main`. Change nothing.

Where to look hardest, if the owner said: $ARGUMENTS

1. Run `git fetch origin`. Read the whole of `git diff origin/main...dev`
   (what is committed), and then `git status --short` and `git diff HEAD`
   (what is not committed yet). Review both, and say which findings are in
   uncommitted work.
2. Look for, in this order: bugs and wrong behaviour; anything that could
   lose or expose a person's data; breaks of the rules in CLAUDE.md; missing
   tests for new behaviour; documents and plans that say something untrue.
3. Run `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run lint`
   and `npm run build`, and report each result.
4. Put every finding in exactly one group:
   - **Must fix** — a person using the app would notice, data could be lost
     or exposed, sign-in or a release could break, or a check in step 3
     fails.
   - **Should fix** — users would not notice, but a later session would be
     misled or left unprotected: a wrong document or plan, a missing test,
     a rule in CLAUDE.md broken without harm yet.
   - **Optional** — taste: naming, tidiness, something that could be nicer.
   When unsure between two groups, pick the lower one and say why in a
   clause. Do not inflate: a list of small things is not a failed review.
5. Reply in this order:
   - **Verdict**, one line, decided by the Must fix group alone: "Ready to
     merge" when it is empty, otherwise "Not ready" and the count.
   - **Must fix**, most serious first. Each with the file and line, what
     would go wrong, and for whom. If there are none, write "None."
   - **Should fix**, the same way, briefly.
   - **Optional**, one line each.
   - **Checks**: the result of each command in step 3.
   - **Not checked**: what this review did not cover, such as running the
     app or trying it on a phone.

Do not fix anything and do not merge. Merging `dev` into `main` happens only
when the owner says so.
