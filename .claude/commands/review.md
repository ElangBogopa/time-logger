---
description: Review what is on dev against main before the owner is asked to merge.
---

Review `dev` against `main`. Change nothing.

1. Run `git fetch origin` and read the whole of `git diff origin/main...dev`.
2. Look for, in this order: bugs and wrong behaviour; anything that could
   lose or expose a person's data; breaks of the rules in CLAUDE.md; missing
   tests for new behaviour.
3. Run `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run lint`
   and `npm run build`, and report each result.
4. Reply with a list of findings, most serious first, each with the file
   and line and what would go wrong. Then one line: ready to merge, or not
   and why. Say what you did not check.

Do not merge. Merging `dev` into `main` happens only when the owner says so.
