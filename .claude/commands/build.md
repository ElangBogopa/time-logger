---
description: Build exactly what a saved plan says, on dev, and check it.
argument-hint: <plan file, e.g. docs/plans/short-name.md>
---

Build the plan in $ARGUMENTS.

1. Run `git branch --show-current`. If it is not `dev`, run `git switch dev`.
   Never commit to or push `main`.
2. Read CLAUDE.md and the plan. Read only the files the plan names.
3. Do the steps in order. Stay inside the plan: if it is wrong or something
   is missing, stop and say what, instead of improvising.
4. Run every check under "Done when". Fix what fails.
5. Do not commit or push unless the owner asks.
6. Reply with: what changed, the result of each check, anything that was
   not done or not verified, and anything you noticed outside the plan.
