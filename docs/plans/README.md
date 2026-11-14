# Plans

One file per change, written by `/plan` and built by `/build`.

The split is about cost: the strongest model writes a short plan, a cheaper
model does the typing from it, and the strongest model reads the result
only when it matters.

1. **Plan** — strongest model, new session, **Auto mode**: `/plan <what you want>`.
   It saves a brief here and stops.
2. **Build** — Sonnet, new session, Auto mode: `/build docs/plans/<name>.md`
3. **Review** — strongest model, new session, before a merge: `/review`

Do not use Plan mode for step 1. Its Approve button starts building at
once, in the same session and on the same expensive model, and no brief
is saved — which is how the first plan made this way got built by the
planner.

Start a new session for each step and for each change. A long session
re-reads its whole history on every message, and that is where credits go.
