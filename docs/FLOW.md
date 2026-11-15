# The flow

Every change follows the same five steps, with an optional one before them. All in **Auto** mode. Start a
**new chat** (the + button) wherever it says so.

| # | Step | Model | Type this | It ends by |
|---|------|-------|-----------|------------|
| 0 | Think · optional | Opus (Fable if risky) | `/do-think <a rough idea>` | handing you a `/do-all` line to paste |
| 1 | Plan | Opus (Fable if risky) | `/do-plan <what you want>` | saving a brief in `docs/plans/` and naming the models to use |
| 2 | Build · new chat | the one the plan named, usually Sonnet | `/do-build docs/plans/<name>.md` | committing to `dev` |
| 3 | Review · new chat | the one the plan named, usually Opus | `/do-review` | a verdict, and a log entry |
| 4 | Fix · any chat | the one the review named | `/do-fix` | committing to `dev` |
| 5 | Release | any | `push`, test on your phone, then `merge dev into main` | the live app changing |

## When to think first

Use `/do-think` when the idea is still rough: you know what bothers you
but not what you want instead. It says your idea back, waits for you to
confirm, asks one question at a time, and ends with a ready `/do-all`
line. It writes nothing. Paste that line **in the same chat**.

Skip it when you can already say what you want in a sentence or two.

## Letting it run

`/do-all <the paragraph from /do-think>` does steps 1 to 4 by itself:
it plans, builds, reviews and fixes, each with a fresh helper on the
model the step before named, and goes round until a review finds
nothing that must or should be fixed. Then it pushes `dev` and asks
whether to carry on with the optional findings.

It stops and asks you only if the plan had to guess at something. It
stops and does not push if a finding comes back after a stronger
model has tried it, or after five rounds, and tells you which command
to run by hand next.

Findings that were already in the log before the run are left alone.

To go step by step instead, paste the same paragraph after `/do-plan`
and follow the table.

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

That is for doing it by hand. `/do-all` has its own limit of five rounds.

## When to start a new chat

New chat when the next step does not need to remember the last one.

| From → to | New chat? |
|---|---|
| Think → Plan | No |
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
- `/do-build` and `/do-fix` commit by themselves. Nothing pushes
  until you type `push`, except `/do-all`, which pushes `dev` when its
  run finishes clean.
- Use the `/do-` commands. Plain `/plan` and `/review` are Claude Code's
  own and know none of this.
- Not Plan mode. Its Approve button starts building on the expensive model.
- After a command is added or renamed: ⌘⇧P → `Reload Window`.

## Where things are

- Briefs: `docs/plans/`
- Review log: `docs/reviews/open.md`
- The commands themselves: `.claude/commands/`
- The project's rules: `CLAUDE.md`
