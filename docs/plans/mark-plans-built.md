# A built plan is marked built by the build itself

> **BUILT - do not run again.** Built on 2026-11-14 in the commit titled "chore: /do-build marks the plan it built and commits it". It stays as the record of what was asked.

Closes two findings in `docs/reviews/open.md` (review 7):
`voice-eval-plan-not-marked-built` and `friends-plan-not-marked-built`,
and the cause behind them. The same finding has now been raised four
times, once per build.

## Goal

When `/do-build` finishes, the plan it built already says "BUILT - do not
run again" and is in the same commit, so no review has to ask for it again.
The two plans that are still unmarked get their line now.

## Why it keeps happening (read this before the steps)

`docs/plans/README.md` says a built plan is marked, but no command does
it. `/do-build` stages only "the files this build changed", so the plan
file, which `/do-plan` leaves untracked, is neither marked nor committed.
The marker used so far names the commit's short id, which does not exist
until after the commit, so marking needed a second commit that nobody was
told to make. The fix is to name the date and the commit's title instead,
both known before committing, and to make it a step of `/do-build`.

## Files

- `.claude/commands/do-build.md`: refuse a plan already marked BUILT or
  PARKED; mark the plan and stage it as part of the build's commit.
- `docs/plans/README.md`: say who writes the marker and what it holds.
- `docs/plans/review-voice-eval.md`: add the marker (currently untracked;
  this build commits it).
- `docs/plans/friends-or-family-line.md`: add the marker.
- `docs/plans/mark-plans-built.md` (this file): add the marker, by hand,
  because the session building it loaded the old `/do-build` text.

No file under `src/` changes.

## Steps

1. `git branch --show-current`; if it is not `dev`, `git switch dev`.

2. In `.claude/commands/do-build.md`, step 2 begins "Read CLAUDE.md and the
   plan." Insert directly after that sentence:

   ```
   If one of the plan's first ten lines says **BUILT** or **PARKED**, stop
   and say so: it is not to be built.
   ```

3. In the same file, in step 5, add a new bullet as the **first** bullet of
   the list (before "Commit only on `dev`."):

   ```
   - First mark the plan as built. Insert, as a new paragraph directly
     under the plan's title line, with a blank line either side:
     `> **BUILT - do not run again.** Built on YYYY-MM-DD in the commit
     titled "<the commit's first line>". It stays as the record of what
     was asked.`
     Use today's date and the exact first line of the commit message you
     are about to write. Do not use the commit id: it does not exist yet.
   ```

   and change the bullet that begins "Stage the files this build changed,
   by name." so that it reads:

   ```
   - Stage the files this build changed, by name, and the plan file itself
     (it is usually untracked until now). Never `git add -A`, and never
     anything else the plan did not call for.
   ```

4. In `docs/plans/README.md`, replace the paragraph that begins "Once a
   brief has been built, a line at the top marks it" with:

   ```
   Once a brief has been built, a line at the top marks it **BUILT - do not
   run again**, with the date and the title of the commit that built it.
   `/do-build` writes that line itself and commits the brief with the
   build, so a built brief is never left unmarked or untracked. It stays
   as the record of what was asked; `/do-build` refuses a brief marked
   BUILT or PARKED.
   ```

5. In `docs/plans/review-voice-eval.md`, insert under the title line (line
   1), with a blank line either side:

   ```
   > **BUILT - do not run again.** Built in `fc8affe` (2026-11-14). It stays as the record of what was asked.
   ```

6. In `docs/plans/friends-or-family-line.md`, insert under the title line,
   with a blank line either side:

   ```
   > **BUILT - do not run again.** Built in `dac322b` (2026-11-14). It stays as the record of what was asked.
   ```

7. Decide the commit's first line now:
   `chore: /do-build marks the plan it built and commits it`.
   In this file (`docs/plans/mark-plans-built.md`), insert under the title
   line, with a blank line either side, with today's date filled in:

   ```
   > **BUILT - do not run again.** Built on YYYY-MM-DD in the commit titled "chore: /do-build marks the plan it built and commits it". It stays as the record of what was asked.
   ```

8. Run the checks under "Done when".

9. Commit on `dev`, staging exactly these five files by name:
   `.claude/commands/do-build.md`, `docs/plans/README.md`,
   `docs/plans/review-voice-eval.md`,
   `docs/plans/friends-or-family-line.md`,
   `docs/plans/mark-plans-built.md`. Use the first line from step 7. Do
   not push.

## Rules that apply

- Branches: work on `dev`, never commit to or push `main`. `/do-build`
  commits to `dev` by itself once its checks pass and does not push.
- The repository is public: nothing private goes into a plan or a command.

## Do not

- Do not change anything under `src/`, `scripts/` or `CLAUDE.md`.
- Do not stage or commit `docs/reviews/open.md`. It has uncommitted review
  entries that are not part of this build; leave them as they are.
- Do not reword the markers already in `brand-voice-fixes.md`,
  `stale-google-token.md`, `park-clerk.md` or `clerk-migration.md`.
- Do not change `/do-plan`, `/do-review`, `/do-fix`, `/do-think`,
  `/do-help` or `docs/FLOW.md`.
- Do not add a test that scans `docs/plans/`: a brief that is saved and
  not yet built is a normal state, and a test cannot tell it from a
  forgotten one.

## Done when

- `grep -L "BUILT\|PARKED" docs/plans/*.md` (the files with neither word)
  prints nothing.
- `grep -n "mark the plan as built" .claude/commands/do-build.md` and
  `grep -n "BUILT\*\* or \*\*PARKED" .claude/commands/do-build.md` each
  print one line.
- `git status --short` after the commit shows only
  ` M docs/reviews/open.md`.
- `npx tsc --noEmit` clean, `npm test` passing, `npm run lint` at 0 errors
  and 54 warnings, `npm run build` succeeding. None should move: no code
  changed.
- Nothing to look at in the app.

## Not decided

Nothing.

## Who should build and review this

- *Build with* **Haiku**: every edit is given word for word, and there is
  no decision in it.
- *Review with* no separate review: the next `/do-review` settles the two
  findings by reading the plans' first lines, and the real proof is the
  next `/do-build` marking its own plan.
- *Effort*: low. It is five small text edits and one commit.
