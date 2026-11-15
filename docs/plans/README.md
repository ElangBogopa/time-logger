# Plans

One file per change, written by `/do-plan` and built by `/do-build`.

The split is about cost: the strongest model writes a short plan, a cheaper
model does the typing from it, and the strongest model reads the result
only when it matters.

0. **Think** (optional) — `/do-think <a rough idea>`. A conversation that
   ends with a `/do-plan` line to paste in the same session.
1. **Plan** — strongest model, new session, **Auto mode**: `/do-plan <what you want>`.
   It saves a brief here and stops.
2. **Build** — Sonnet, new session, Auto mode: `/do-build docs/plans/<name>.md`.
   It commits to `dev` when its checks pass, and does not push.
3. **Review** — strongest model, new session, before a merge: `/do-review`.
   It covers committed and uncommitted work on `dev`, and sorts what it
   finds into must fix, should fix and optional. Only must-fix findings
   decide "ready to merge". It keeps a log in `docs/reviews/open.md`, so a
   later review knows what was found and what was tried.
4. **Fix** — the model the review names, any session: `/do-fix`. It fixes
   the must-fix findings (or `/do-fix must and should`), records the
   attempt in the log, and commits to `dev`. If a problem comes back after
   a fix, the next review says so and names a stronger model; after two
   failed attempts it says to stop and re-plan.

Do not use Plan mode for step 1. Its Approve button starts building at
once, in the same session and on the same expensive model, and no brief
is saved — which is how the first plan made this way got built by the
planner.

Start a new session for each step and for each change. A long session
re-reads its whole history on every message, and that is where credits go.

Once a brief has been built, a line at the top marks it **BUILT - do not
run again**, with the date and the title of the commit that built it.
`/do-build` writes that line itself and commits the brief with the
build, so a built brief is never left unmarked or untracked. It stays
as the record of what was asked; `/do-build` refuses a brief marked
BUILT or PARKED.

The commands are named `/do-think`, `/do-plan`, `/do-build`, `/do-review` and `/do-fix` on purpose.
Claude Code has commands of its own called `/plan` and `/review`; typing
those runs the built-in ones, which know nothing of this routine — no
saved brief, no recommended model, no must-fix sorting.
