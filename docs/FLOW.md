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
model the step before named, and goes round until every finding a
review made — optional ones included — is fixed or closed. Then it
pushes `dev`, once, and asks you nothing. There is always
at least one review before it pushes, even when the plan said none
was needed.

A finding gets two tries at most: Sonnet first (or a stronger model if
the review names one), then Fable, once, given the story of what was
tried, what it broke and every example as a test. Damage a fix does
counts as the same finding, not a new one. If Fable cannot fix an
optional finding, the report lists it under
**Fable could not fix this** and the run still pushes. A finding that would undo what the
plan chose on purpose, or go past what you asked, is not fixed: the
report lists it under **Not chased** for you to decide.

It does not stop for choices the plan had to make. The planner makes
the one it would recommend and carries on, and the report lists them:
the ones you would notice — what the app shows or says, or what the
change includes — first, under **Decided for you**, each with the other
choice, so you can reverse one after trying the `dev` preview; the rest,
like a test's name or where a file goes, under **Guessed without
asking**. A choice your request already made is not listed at all. A
guess never stops the run, but a choice the request does not settle about
a person's data (what is stored, deleted, exported or sent), or that
would change or go against a rule in `CLAUDE.md`, is not a guess: the
plan asks about it. The run stops and asks you when the plan could not
be written (the request is too vague, breaks a rule in `CLAUDE.md`, or
rests on something not true of the code), when the plan asks about such
a choice, when the plan still leaves something undecided, or when the
working tree holds anything but the review log before it starts. It
stops and does not push if a build or a fix leaves no commit, if Fable could not fix a must- or should-fix
finding, if a must-fix finding is the plan's own choice, after five
rounds, or if `dev` is not the branch at the end, and tells you which
command to run by hand next.

Findings that were already in the log before the run are left alone.

To go step by step instead, paste the same paragraph after `/do-plan`
and follow the table.

## What to do after a review

- **"Ready to merge"** → `push`, open the `dev` preview on your phone, try
  the change. Happy? `merge dev into main`.
- **"Not ready"** → `/do-fix` on the model it names. If the fix changed how
  the app behaves, new chat and `/do-review` once more.
- **A finding marked recurring** → `/do-fix <id>` on Fable. It gathers
  the story itself.
- **A must- or should-fix finding closed** ("Fable could not fix
  this") → the plan is wrong. New chat, `/do-plan` again.
- **Marked plan's choice or past the request** → yours to decide; no
  fix is suggested.

Only **must-fix** findings block a release. Should-fix: once, if cheap
(`/do-fix must and should`). Optional: your
choice — the review names who would try them, on the same ladder.

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
- **Stuck:** a fix that failed once → Fable, once, with the story. There
  is no third try.
- **Risky** (sign-in, deleting data, payments, reminders, the database):
  Fable for the plan and the review.

## Rules that never change

- Everything goes to `dev`. Nothing reaches `main` until you type
  `merge dev into main`.
- `/do-build` and `/do-fix` commit by themselves. Nothing pushes
  until you type `push`, except `/do-all`, which pushes `dev` when every finding it chases is
  fixed or closed.
- Use the `/do-` commands. Plain `/plan` and `/review` are Claude Code's
  own and know none of this.
- Not Plan mode. Its Approve button starts building on the expensive model.
- After a command is added or renamed: ⌘⇧P → `Reload Window`.

## Where things are

- Briefs: `docs/plans/`
- Review log: `docs/reviews/open.md`
- The commands themselves: `.claude/commands/`
- The project's rules: `CLAUDE.md`
