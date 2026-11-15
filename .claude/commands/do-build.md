---
description: Build exactly what a saved plan says, on dev, check it, and commit it there.
argument-hint: <plan file, e.g. docs/plans/short-name.md>
---

Build the plan in $ARGUMENTS.

1. Run `git branch --show-current`. If it is not `dev`, run `git switch dev`.
   Never commit to or push `main`.
2. Read CLAUDE.md and the plan. If one of the plan's first ten lines says
   **BUILT** or **PARKED**, stop and say so: it is not to be built.
   Read only the files the plan names. If the
   plan recommends a model for the build and you are a different one, say
   so in one line before starting, so the owner can switch; then carry on
   unless told to stop.
3. Do the steps in order. Stay inside the plan: if it is wrong or something
   is missing, stop and say what, instead of improvising.
4. Run every check under "Done when". Fix what fails.
5. When every check passes, commit to `dev` without being asked. The
   owner has said so in advance: a build that passes is always committed,
   because that is what gets reviewed.
   - First mark the plan as built. Insert, as a new paragraph directly
     under the plan's title line, with a blank line either side:
     `> **BUILT - do not run again.** Built on YYYY-MM-DD in the commit
     titled "<the commit's first line>". It stays as the record of what
     was asked.`
     Use today's date and the exact first line of the commit message you
     are about to write. Do not use the commit id: it does not exist yet.
   - Commit only on `dev`. Check the branch again right before committing.
   - Stage the files this build changed, by name, and the plan file itself
     (it is usually untracked until now). Never `git add -A`, and never
     anything else the plan did not call for.
   - Write the message the way the project's history does: what changed
     and why, then what was and was not checked.
   - If a check still fails after you have tried to fix it, do not commit.
     Leave the work in place and say what fails.
6. Do not push, and do not ask whether to. Pushing happens when the owner
   says "push".
7. Reply with: what changed, the commit (its short id) or why there is
   none, the result of each check, anything that was not done or not
   verified, and anything you noticed outside the plan. End with the next
   step: "Start a new session, switch to <the plan's review model>, and run
   `/do-review`."
