# Plans

One file per change, written by `/plan` and built by `/build`.

The split is about cost: the strongest model writes a short plan, a cheaper
model does the typing from it, and the strongest model reads the result
only when it matters.

1. **Plan** — strongest model, new session, **Auto mode**: `/plan <what you want>`.
   It saves a brief here and stops.
2. **Build** — Sonnet, new session, Auto mode: `/build docs/plans/<name>.md`
3. **Review** — strongest model, new session, before a merge: `/review`.
   It covers committed and uncommitted work on `dev`, and sorts what it
   finds into must fix, should fix and optional. Only must-fix findings
   decide "ready to merge"; fix those, and stay in the same session to do
   it (switch to Sonnet and say "fix the must-fix findings").

Do not use Plan mode for step 1. Its Approve button starts building at
once, in the same session and on the same expensive model, and no brief
is saved — which is how the first plan made this way got built by the
planner.

Start a new session for each step and for each change. A long session
re-reads its whole history on every message, and that is where credits go.

Once a brief has been built, a line at the top marks it **BUILT - do not
run again**, with the commit. It stays as the record of what was asked;
do not point `/build` at it.
