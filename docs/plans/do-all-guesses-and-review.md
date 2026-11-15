# /do-all asks only about guesses the owner would notice, and always reviews

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "feat: /do-all asks only about guesses the owner would notice, and always reviews". It stays as the record of what was asked.

## Goal

`/do-all` stops to ask the owner only when the plan guessed at something
the owner would notice, asked a question, or left something undecided. It
goes ahead on guesses the owner would never notice (a test's name, where a
file goes) and lists them in its final report. And it always runs a review
before it pushes, even when the brief says "no review needed".

## Why (read this before the steps)

Today `.claude/commands/do-all.md` step 1 stops if the plan helper "listed
any guess", and the prompt it gives the planner asks for "every choice you
made that the request did not settle". A planner always makes some such
choices, so every run stops, even for a test's name. The fix is to have the
planner sort its guesses into two kinds and to stop only for the first.

Separately, step 2 skips the review when the brief says "no review needed".
That makes it possible for `/do-all` to push work nobody has read. The
owner wants at least one review in every run.

Nothing else about the flow changes: one helper at a time, five rounds at
most, never `main`, no push after an early stop.

## Files

- `.claude/commands/do-all.md` — the planner's extra prompt asks for the
  two kinds of guess; step 1 stops only for the first kind; step 2 always
  goes on to step 3; the report gets a heading for the second kind; "Never"
  gets one line.
- `.claude/commands/do-plan.md` — one parenthetical on the "no review
  needed" option saying `/do-all` reviews anyway.
- `docs/FLOW.md` — the "Letting it run" section says when it stops now and
  that there is always a review.
- `docs/plans/README.md` — the `/do-all` paragraph says there is always at
  least one review.
- `CLAUDE.md` — the `/do-all` standing exception in "Branches" says the
  push comes only after at least one review.

## Steps

1. **`.claude/commands/do-all.md`, step 1, the quoted addition to the
   planner's prompt.** Replace the whole quoted block (the lines starting
   `> You cannot ask the owner anything.` through `` > did not settle, or `GUESSES: none`. ``)
   with:

   > You cannot ask the owner anything. If step 2 of the command would have
   > you ask, do not write the brief: reply with `QUESTIONS:` and the
   > questions, in plain language. Otherwise save the brief, and end your
   > reply with every choice you made that the request did not settle,
   > sorted into two lists:
   >
   > `GUESSES THE OWNER WOULD NOTICE:` choices about what a person sees or
   > reads in the app, a person's data, a rule in `CLAUDE.md`, or what is
   > in or out of the change.
   >
   > `GUESSES THE OWNER WOULD NOT NOTICE:` everything else — the name of a
   > test, where a file goes, which model or effort, wording inside code
   > or the command files that no person using the app reads.
   >
   > Write `none` after a heading that has nothing under it. When unsure
   > which list a choice belongs to, put it in the first.

2. **`.claude/commands/do-all.md`, step 1, the stop rule.** Replace the
   paragraph that begins `**Stop and ask the owner** if the helper returned
   questions, if it listed any guess,` and the paragraph after it (ending
   `no guesses and nothing undecided.`) with:

   > **Stop and ask the owner** if the helper returned questions, if it
   > listed anything under `GUESSES THE OWNER WOULD NOTICE`, or if the
   > brief's "Not decided" part says anything other than "nothing". Read
   > the other list too: a guess there that plainly falls under one of the
   > first list's kinds counts as the first kind. Put the questions to the
   > owner in plain language, one message, and wait. When they are
   > answered, start a new plan helper with the original request followed
   > by "The owner has since settled: <the answers>. Replace the brief at
   > <path>." Repeat until a brief comes back with no questions, nothing
   > the owner would notice guessed, and nothing undecided.
   >
   > Do not stop for `GUESSES THE OWNER WOULD NOT NOTICE`. Keep that list,
   > from the plan helper whose brief is built, for the report.

   Leave the sentence after it ("Then read the brief's "Who should build
   and review this" part ...") as it is.

3. **`.claude/commands/do-all.md`, step 2.** Delete the paragraph
   `If the brief says "no review needed", go to "A clean finish" and say in
   the report that nothing was reviewed.` In its place write:

   > Then go to step 3, always. A brief that says "no review needed" is
   > still reviewed: use `opus` and the brief's effort for that review.

4. **`.claude/commands/do-all.md`, step 3.** In the line `Model: the one
   the brief names for the review. Effort: the one the brief names.`
   append: ` (`opus` if the brief says no review is needed.)`

5. **`.claude/commands/do-all.md`, "The report".** After the **Fixed**
   bullet and before **Left from before this run**, add:

   > - **Guessed without asking**: the plan's `GUESSES THE OWNER WOULD NOT
   >   NOTICE`, one line each, or "nothing".

6. **`.claude/commands/do-all.md`, "Never".** Add, after `- Never push
   when the run stopped early.`:

   > - Never push before at least one review has run in this run.

7. **`.claude/commands/do-plan.md`, step 3, the *Review with* bullet.**
   After `Say "no review needed" for a change a person can fully judge by
   looking at the screen.` add: ` (`/do-all` reviews it anyway, on Opus.)`
   Change nothing else in this file.

8. **`docs/FLOW.md`, "Letting it run".** Replace the sentence
   `It stops and asks you only if the plan had to guess at something.`
   (the first sentence of the section's second paragraph) with:

   > It stops and asks you only if the plan had a question, left something
   > undecided, or had to guess at something you would notice — what the
   > app shows or says, your data, a rule in `CLAUDE.md`, or what the
   > change includes. Guesses you would never notice, like a test's name
   > or where a file goes, it makes and lists in its report.

   Keep the rest of that paragraph (`It stops and does not push if ...`).
   At the end of the first paragraph of the section (after `... carry on
   with the optional findings.`) add: `There is always at least one review
   before it pushes, even when the plan said none was needed.`

9. **`docs/plans/README.md`.** In the `/do-all` paragraph, after `until a
   review finds nothing that must or should be fixed.` add: `There is
   always at least one review, even when the brief says none is needed.`

10. **`CLAUDE.md`, "Branches", the second standing exception.** Change
    `` `/do-all` pushes `dev` to `origin dev` by itself when its run ends
    with nothing left that must or should be fixed, `` so it reads
    `` `/do-all` pushes `dev` to `origin dev` by itself when its run ends
    with nothing left that must or should be fixed, after at least one
    review (a brief that says no review is needed is still reviewed), ``
    and leave the rest of the bullet as it is. Change nothing else in
    `CLAUDE.md`.

11. Read the four `do-all` mentions side by side (`do-all.md`, `FLOW.md`,
    `docs/plans/README.md`, `CLAUDE.md`) and confirm they say the same
    thing about when it stops and that it always reviews.

## Rules that apply

- `CLAUDE.md` "Branches": work on `dev`, never `main`. `/do-build` commits
  to `dev` and does not push. The push in "Done when" is `/do-all`'s clean
  finish, not the builder's.
- The `/do-all` flow's existing limits stay exactly as written: one helper
  at a time, five rounds, never `main`, no push after an early stop.

## Do not

- Do not change `do-build.md`, `do-review.md`, `do-fix.md`, `do-think.md`
  or `do-help.md`.
- Do not change the rounds, the model ladder, the earlier-findings rule,
  the review arguments or anything in "When the run stops" in `do-all.md`.
- Do not touch any app code, tests or `docs/reviews/open.md`.
- Do not push, and do not touch `main`.

## Done when

- `grep -n "listed any guess" .claude/commands/do-all.md` finds nothing.
- `grep -n "GUESSES THE OWNER WOULD NOTICE" .claude/commands/do-all.md`
  finds the prompt and the stop rule; `grep -n "Guessed without asking"`
  finds the report heading.
- `grep -n "nothing was reviewed" .claude/commands/do-all.md` finds nothing.
- `grep -n "at least one review" CLAUDE.md docs/FLOW.md docs/plans/README.md .claude/commands/do-all.md`
  finds one line in each.
- `npx tsc --noEmit`, `npm test`, `npm run test:tz` and `npm run build`
  pass; `npm run lint` stays at 0 errors and 54 warnings (its count today).
- Nothing to look at in the app: no app file changes. `dev` is pushed by
  `/do-all` at its clean finish.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**: text edits to five files, with the new wording
  given here word for word.
- *Review with* **Opus**: the change governs when the flow stops and
  pushes, so a slip in wording matters, but it touches no sign-in, data,
  payments, reminders or database.
- *Effort*: medium.
