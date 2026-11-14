---
description: Fix findings from the latest review, and record what was attempted so the next review can tell.
argument-hint: [which findings: "must" (default), "must and should", or ids]
---

Fix findings from the latest review of `dev`.

Which ones: $ARGUMENTS
If nothing is given, fix the open and recurring **must-fix** findings only.

1. Run `git branch --show-current`. If it is not `dev`, run `git switch dev`.
   Never commit to or push `main`.
2. Read `docs/reviews/open.md` (format in `docs/reviews/README.md`). If it
   does not exist, stop and say that `/do-review` has to run first.
3. For each finding you were asked to fix, read the log's history of it
   before touching anything.
   - If the latest review recommended a stronger model than you for it,
     say so in one line and leave that finding alone unless the owner
     tells you to go on.
   - If it was marked "stop fixing", do not attempt it. Say that it needs
     `/do-plan`.
   - If it was attempted before, read what was tried and do something
     different. Repeating the same fix is how it recurred.
4. Fix it at the cause. Add or change a test that would have caught it,
   where one can be written. Stay inside the findings: no other tidying.
5. Run `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run lint`
   and `npm run build`.
6. Append an attempt entry to `docs/reviews/open.md`: the date, the model
   you are, and for each finding its id, what you changed in one line, and
   whether you believe it is fixed, partly fixed, or not fixed. Be honest
   in that last part — the next review checks the code, not your claim.
7. If the checks pass, commit to `dev`: the files you changed by name, plus
   the log. Do not push.
8. Reply with: each finding and what you did, anything you left alone and
   why, the commit, the check results, and the next step — a new session
   and `/do-review` if app code changed, or "push and try it on a phone" if
   only documents or tests did.
