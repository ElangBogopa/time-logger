# Plans

One file per change, written by `/plan` and built by `/build`.

The split is about cost: the strongest model writes a short plan, a cheaper
model does the typing from it, and the strongest model reads the result
only when it matters.

1. **Plan** — strongest model, new session: `/plan <what you want>`
2. **Build** — Sonnet, new session: `/build docs/plans/<name>.md`
3. **Review** — strongest model, new session, before a merge: `/review`

Start a new session for each step and for each change. A long session
re-reads its whole history on every message, and that is where credits go.
