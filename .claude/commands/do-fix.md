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
   - If it is marked `plan's choice` or `past the request`, do not attempt
     it, whoever asks in the arguments: say it is the owner's to decide.
   - If it is closed ("Fable could not fix this"), do not attempt it. If it
     is must or should, say it needs `/do-plan`.
   - If it was attempted before, this is its second and last attempt, and
     the ladder gives it to Fable. If you are not Fable, say so in one line
     and leave it unless the owner tells you to go on. Before touching
     anything, gather its story, unless your prompt already gives it:
     every earlier attempt at it (the model, its attempt line, and what its
     commit changed — find the commit with
     `git log -S "## Fix attempt <n> —" --format=%h -- docs/reviews/open.md`,
     then `git show <commit>`); every review line about it after each
     attempt, including "leave it" remarks and, in a log written before
     this rule, lines marked "caused by fix" that name the same file and
     code; and every example named in any of those lines, with the answer
     it must give. Do something different from every earlier attempt.
4. Fix it at the cause. Add or change a test that would have caught it,
   where one can be written. On a second attempt, every example from
   its story is a test with its correct answer, and none of them may change
   answer. If, on a second attempt, it cannot be done well, change no app
   code and say so, with your reasons, in the attempt entry: that answer is
   your attempt. Stay inside the findings: no other tidying.
5. Run `npx tsc --noEmit`, `npm test`, `npm run test:tz`, `npm run lint`
   and `npm run build`.
6. Append an attempt entry to `docs/reviews/open.md`: the date, the model
   you are, and for each finding its id, what you changed in one line, and
   whether you believe it is fixed, partly fixed, not fixed,
   or cannot be done well (with the reasons). Be honest
   in that last part — the next review checks the code, not your claim.
7. If the checks pass, commit to `dev`: the files you changed by name, plus
   the log. If only the log changed (you answered that it cannot be done
   well), commit the log alone. Do not push.
8. Reply with: each finding and what you did, anything you left alone and
   why, the commit, the check results, and the next step — a new session
   and `/do-review` if app code changed, or "push and try it on a phone" if
   only documents or tests did.
