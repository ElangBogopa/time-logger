# The flow

Every change follows the same five steps. All in **Auto** mode. Start a
**new chat** (the + button) wherever it says so.

| # | Step | Model | Type this | It ends by |
|---|------|-------|-----------|------------|
| 1 | Plan | Opus (Fable if risky) | `/do-plan <what you want>` | saving a brief in `docs/plans/` and naming the models to use |
| 2 | Build · new chat | the one the plan named, usually Sonnet | `/do-build docs/plans/<name>.md` | committing to `dev` |
| 3 | Review · new chat | the one the plan named, usually Opus | `/do-review` | a verdict, and a log entry |
| 4 | Fix · any chat | the one the review named | `/do-fix` | committing to `dev` |
| 5 | Release | any | `push`, test on your phone, then `merge dev into main` | the live app changing |

## What to do after a review

- **"Ready to merge"** → `push`, open the `dev` preview on your phone, try
  the change. Happy? `merge dev into main`.
- **"Not ready"** → `/do-fix` on the model it names. If the fix changed how
  the app behaves, new chat and `/do-review` once more.
- **A finding marked recurring** → use the stronger model it names.
- **"Stop fixing"** → the plan is wrong. New chat, `/do-plan` again.

Only **must-fix** findings block a release. Should-fix: once, if cheap
(`/do-fix must and should`). Optional: ignore.

**Two reviews per change at most.** After that the phone is the better
judge.

## When to start a new chat

New chat when the next step does not need to remember the last one.

| From → to | New chat? |
|---|---|
| Plan → Build | Yes |
| Build → Review | Yes |
| Review → Fix | Either |
| Fix → Review again | Yes |
| Build → a small tweak to it | No |

## Shortcuts

- **Tiny change** (wording, a colour): skip 1 and 3. Sonnet, new chat, say
  what you want, then `commit` and `push`.
- **Stuck:** Sonnet failing twice on the same thing → switch to Opus.
- **Risky** (sign-in, deleting data, payments, reminders, the database):
  Fable for the plan and the review.

## Rules that never change

- Everything goes to `dev`. Nothing reaches `main` until you type
  `merge dev into main`.
- `/do-build` and `/do-fix` commit by themselves. Nothing pushes until you
  type `push`.
- Use the `/do-` commands. Plain `/plan` and `/review` are Claude Code's
  own and know none of this.
- Not Plan mode. Its Approve button starts building on the expensive model.
- After a command is added or renamed: ⌘⇧P → `Reload Window`.

## Where things are

- Briefs: `docs/plans/`
- Review log: `docs/reviews/open.md`
- The commands themselves: `.claude/commands/`
- The project's rules: `CLAUDE.md`
