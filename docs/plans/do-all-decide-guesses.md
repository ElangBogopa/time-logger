# /do-all decides the plan's guesses instead of stopping for them

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: /do-all decides the plan's guesses and reports them as Decided for you". It stays as the record of what was asked.

## Goal

`/do-all` no longer stops for a guess. The planner makes the choice it
would recommend and carries on, and the final report shows the choices the
owner would notice first, under **Decided for you**, each with the other
choice, so the owner can reverse one after trying the `dev` preview. The
run still stops and asks when the planner could not write a brief at all,
or when the brief leaves something undecided.

## Why (read this before the steps)

Today `.claude/commands/do-all.md` step 1 stops whenever the planner lists
anything under `GUESSES THE OWNER WOULD NOTICE`. In practice it stops for
things the request already answered, and for small consequences the
planner could have decided. The owner would rather the run go ahead and be
told plainly what was decided, since the `dev` preview is where any of it
gets tried and reversed.

What stays a stop: the planner returns `QUESTIONS:` (the request is too
vague to plan, it breaks a rule in `CLAUDE.md`, or it rests on something
that is not true of the code), or the brief's "Not decided" part says
anything other than "nothing".

Nothing else about the flow changes: a review always runs before a push,
one helper at a time, five rounds at most, never `main`, no push after an
early stop.

## Files

- `.claude/commands/do-all.md` — the planner's extra prompt in step 1
  (when to ask, decide otherwise, what is not a guess, one line per guess
  with the other choice); the stop rule in step 1 (stop only for questions
  or something undecided); "The report" (a **Decided for you** heading
  first).
- `docs/FLOW.md` — "Letting it run": when it stops, and what the report
  lists.
- `docs/plans/README.md` — the `/do-all` paragraph: one sentence on
  guesses.
- `CLAUDE.md` — "Branches", the `/do-all` standing exception: one sentence.

## Steps

1. **`.claude/commands/do-all.md`, step 1, the quoted addition to the
   planner's prompt.** Replace the whole quoted block (from the line
   `> You cannot ask the owner anything. If step 2 of the command would have`
   through `> which list a choice belongs to, put it in the first.`) with
   exactly:

   > You cannot ask the owner anything, and the run does not stop for a
   > guess. Ask a question only when no sensible brief can be written
   > without the answer: the request is too vague to plan, it breaks a
   > rule in `CLAUDE.md`, or it rests on something that is not true of the
   > code. Then do not write the brief: reply with `QUESTIONS:` and the
   > questions, in plain language. In every other case, where step 2 of
   > the command would have you ask, make the choice you would recommend,
   > write it into the brief as decided, and carry on. The brief's "Not
   > decided" part says "nothing": a choice you made goes in the brief and
   > in the lists below, not there.
   >
   > Save the brief, and end your reply with every choice you made that
   > the request did not settle, sorted into two lists. A choice the
   > request states, allows or directly implies is not a guess: list it in
   > neither.
   >
   > `GUESSES THE OWNER WOULD NOTICE:` choices about what a person sees or
   > reads in the app, a person's data, a rule in `CLAUDE.md`, or what is
   > in or out of the change. One plain line each: what you chose, and the
   > other choice.
   >
   > `GUESSES THE OWNER WOULD NOT NOTICE:` everything else — the name of a
   > test, where a file goes, which model or effort, wording inside code
   > or the command files that no person using the app reads.
   >
   > Write `none` after a heading that has nothing under it. When unsure
   > which list a choice belongs to, put it in the first.

2. **`.claude/commands/do-all.md`, step 1, the stop rule.** Replace the
   paragraph that begins `**Stop and ask the owner** if the helper returned
   questions, if it listed anything under` (ending `nothing the owner would
   notice guessed, and nothing undecided.`) and the paragraph after it
   (`Do not stop for `GUESSES THE OWNER WOULD NOT NOTICE`. Keep that list,
   from the plan helper whose brief is built, for the report.`) with
   exactly:

   > **Stop and ask the owner** only if the helper returned `QUESTIONS:`,
   > or if the brief's "Not decided" part says anything other than
   > "nothing". Put the questions, or what is undecided, to the owner in
   > plain language, one message, and wait. When they are answered, start
   > a new plan helper with the original request followed by "The owner
   > has since settled: <the answers>. Replace the brief at <path>."
   > Repeat until a brief comes back with no questions and nothing
   > undecided.
   >
   > Never stop for a guess, in either list. Keep both lists, from the
   > plan helper whose brief is built, for the report. A guess under
   > `GUESSES THE OWNER WOULD NOT NOTICE` that plainly falls under one of
   > the first list's kinds goes in the report with the first list.

   Leave the sentence after it ("Then read the brief's "Who should build
   and review this" part ...") as it is.

3. **`.claude/commands/do-all.md`, "The report".** Make this the first
   bullet, before **Built**:

   > - **Decided for you**: the plan's `GUESSES THE OWNER WOULD NOTICE`,
   >   one plain line each saying what was chosen and what the other choice
   >   was, so the owner can reverse one after trying the `dev` preview; or
   >   "nothing".

   Leave the **Guessed without asking** bullet where it is and as it is.
   The report is the same whether the run finished clean or stopped, so
   this heading appears in both.

4. **`docs/FLOW.md`, "Letting it run".** In the section's second
   paragraph, replace the two sentences from `It stops and asks you only
   if the plan had a question,` through `it makes and lists in its
   report.` with exactly:

   > It does not stop for choices the plan had to make. The planner makes
   > the one it would recommend and carries on, and the report lists them:
   > the ones you would notice — what the app shows or says, your data, a
   > rule in `CLAUDE.md`, or what the change includes — first, under
   > **Decided for you**, each with the other choice, so you can reverse
   > one after trying the `dev` preview; the rest, like a test's name or
   > where a file goes, under **Guessed without asking**. A choice your
   > request already made is not listed at all. It stops and asks you only
   > when the plan could not be written — the request is too vague, breaks
   > a rule in `CLAUDE.md`, or rests on something not true of the code —
   > or when the plan left something undecided.

   Keep the rest of that paragraph (`It stops and does not push if a
   finding comes back ...`) unchanged.

5. **`docs/plans/README.md`.** In the `/do-all` paragraph, after
   `A clean run is pushed to `dev`; a run that stops early is not.` add:
   `It does not stop for the plan's guesses: it decides them and lists
   them in its report, the ones you would notice under "Decided for
   you".` Keep `` `docs/FLOW.md` says when it stops. `` after it.

6. **`CLAUDE.md`, "Branches", the second standing exception.** After the
   sentence that ends `so the preview is ready to try.` (it is wrapped as
   `so the preview\n  is ready to try.`) add: `It does not stop to ask
   about a choice the plan made; its report lists those, the ones the
   owner would notice under "Decided for you", to reverse after trying the
   preview.` Leave the rest of the bullet (`A run that stopped early does
   not push. It never touches `main`.`) as it is. Change nothing else in
   `CLAUDE.md`.

7. Read the four `/do-all` descriptions side by side (`do-all.md`,
   `FLOW.md`, `docs/plans/README.md`, `CLAUDE.md`) and confirm they agree:
   no stop for a guess; a stop for questions or something undecided;
   **Decided for you** first in the report; a review always before a push.

## Rules that apply

- `CLAUDE.md` "Branches": work on `dev`, never `main`. `/do-build` commits
  to `dev` and does not push. The push in "Done when" is `/do-all`'s clean
  finish, not the builder's.
- The `/do-all` flow's other limits stay exactly as written: a review
  always before a push, one helper at a time, five rounds, never `main`,
  no push after an early stop.

## Do not

- Do not change `do-plan.md`, `do-build.md`, `do-review.md`, `do-fix.md`,
  `do-think.md` or `do-help.md`. Step 2 of `do-plan.md` (ask the owner)
  stays as it is for running `/do-plan` by hand; the `do-all.md` prompt
  overrides it for `/do-all`.
- Do not change step 0, steps 2 to 4, "A clean finish", "When the run
  stops", "Never", or the "Say nothing while it runs" paragraph in
  `do-all.md`.
- Do not touch any app code, tests or `docs/reviews/open.md`.
- Do not push, and do not touch `main`.

## Done when

- `grep -n "listed anything under" .claude/commands/do-all.md` finds
  nothing.
- `grep -n "no sensible brief" .claude/commands/do-all.md` finds the
  prompt; `grep -n "states, allows or directly implies" .claude/commands/do-all.md`
  finds it too.
- `grep -n "Never stop for a guess" .claude/commands/do-all.md` finds the
  stop rule.
- `grep -n "Decided for you" .claude/commands/do-all.md docs/FLOW.md docs/plans/README.md CLAUDE.md`
  finds at least one line in each file, and in `do-all.md` it is the first
  bullet under "## The report".
- `grep -n "Guessed without asking" .claude/commands/do-all.md docs/FLOW.md`
  finds a line in each.
- `npx tsc --noEmit`, `npm test`, `npm run test:tz` and `npm run build`
  pass; `npm run lint` shows no errors and the same warning count it
  showed before the build (run it first and note the count).
- Nothing to look at in the app: no app file changes. `dev` is pushed by
  `/do-all` at its clean finish.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**: text edits to four files, with the new wording
  given here word for word.
- *Review with* **Opus**: the change governs when the flow stops, so a
  slip in wording matters, but it touches no sign-in, data, payments,
  reminders or database.
- *Effort*: medium.
