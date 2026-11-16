---
description: Run the whole flow from a /do-think paragraph - plan, build, review, fix - until nothing that should be fixed is left, then push dev.
argument-hint: <the paragraph /do-think handed over>
---

Run the whole flow for this request, without the owner:

$ARGUMENTS

You are the conductor. You do not plan, build, review or fix anything
yourself, and you edit no file. Each step is done by a helper you start
with the Agent tool, one at a time, never two at once. You read what the
helper reports and what it left in the repository, and decide the next
step.

**Say nothing while it runs.** No progress notes between steps. You write
to the owner only when a rule below says to stop and ask, and once at the
end.

This needs Auto mode. If you are in Plan mode, say so and stop.

## How to start a helper

Use the Agent tool with `subagent_type: "general-purpose"`, the `model`
this file names for the step (`haiku`, `sonnet`, `opus` or `fable`), and
the `effort` the plan names where this file says to pass it. The prompt
is:

> Read `.claude/commands/<command>.md` in this repository and follow it
> exactly, as if the owner had typed the command. Where it says
> `$ARGUMENTS`, read: <the arguments>. Nobody can answer you during this
> run. Where the command tells you to stop and say something, stop and put
> it in your final reply. Your final reply is the reply the command asks
> for.

plus whatever the step below adds. Wait for the helper to finish before
doing anything else.

Never trust a helper's summary for a fact you can check. After each one,
look at the repository yourself, as each step says.

## 0. Before anything

1. `git branch --show-current`. If it is not `dev`, `git switch dev`.
2. `git status --short`. If anything is listed other than
   `docs/reviews/open.md`, stop and ask the owner what to do with it: a
   review could not tell it from this run's work.
3. Note the starting commit: `git rev-parse --short HEAD`.
4. If `docs/reviews/open.md` exists, read it and note the id of every
   finding, of any group — must, should or optional — that no `## Review`
   entry lists as resolved or closed. These are the **earlier findings**.
   They are not this run's: never send them to a fix, and never count
   them when deciding whether the run is clean.

## 1. Plan

Model: `opus`. Use `fable` if the request touches sign-in, deleting or
exporting data, payments, reminders, or the shape of the database.

Command: `do-plan`, with the request above as its arguments. Add to the
prompt:

> You cannot ask the owner anything, and the run does not stop for a
> guess. Ask a question only when no sensible brief can be written
> without the answer: the request is too vague to plan, it breaks a
> rule in `CLAUDE.md`, or it rests on something that is not true of the
> code. Also ask when the request does not settle a choice about a
> person's data (what is stored, deleted, exported or sent) or a choice
> that would change or go against a rule in `CLAUDE.md`. Then do not
> write the brief: reply with `QUESTIONS:` and the questions, in plain
> language. In every other case, where step 2 of the command would have
> you ask, make the choice you would recommend, write it into the brief
> as decided, and carry on. When you have decided everything, the
> brief's "Not decided" part says "nothing": a choice you made goes in
> the brief and in the lists below, not there.
>
> Save the brief, and end your reply with every choice you made that
> the request did not settle, sorted into two lists. A choice the
> request states or directly implies is not a guess: list it in
> neither. A choice the request merely leaves open is a guess.
>
> `GUESSES THE OWNER WOULD NOTICE:` choices about what a person sees or
> reads in the app, or what is in or out of the change. One plain line each: what you chose, and the
> other choice.
>
> `GUESSES THE OWNER WOULD NOT NOTICE:` everything else — the name of a
> test, where a file goes, which model or effort, wording inside code
> or the command files that no person using the app reads.
>
> Write `none` after a heading that has nothing under it. When unsure
> which list a choice belongs to, put it in the first.

When it returns, read the brief it saved.

**Stop and ask the owner** only if the helper returned `QUESTIONS:`
(which includes a choice about a person's data or a rule in `CLAUDE.md`
that the request did not settle), or if the brief's "Not decided" part
says anything other than "nothing". That second stop is a backstop for
a brief that still leaves something open; a planner that has decided
everything writes "nothing". Put the questions, or what is undecided, to the owner in
plain language, one message, and wait. When they are answered, start
a new plan helper with the original request followed by "The owner
has since settled: <the answers>. Replace the brief at <path>."
Repeat until a brief comes back with no questions and nothing
undecided.

Never stop for a guess, in either list. Keep both lists, from the plan
helper whose brief is built, for the report. A guess under
`GUESSES THE OWNER WOULD NOT NOTICE` that plainly falls under one of
the first list's kinds goes in the report with the first list, with
the other choice if the planner's line gives one, and otherwise "other
choice not given".

Then read the brief's "Who should build and review this" part and note
the build model, the review model and the effort.

## 2. Build

Model: the one the brief names for the build. Effort: the one the brief
names.

Command: `do-build`, with the brief's path as its arguments.

When it returns, check: `git log --oneline -1` shows a new commit on
`dev`, and the brief's first lines say **BUILT**. If there is no commit,
the run **stops** (see "When the run stops"): the build could not pass its
own checks or found the plan wrong.

Then go to step 3, always. A brief that says "no review needed" is
still reviewed: use `opus` and the brief's effort for that review.

## 3. Review

Model: the one the brief names for the review. Effort: the one the brief
names. (`opus` if the brief says no review is needed.)

Command: `do-review`, with these arguments:

> The commits after <starting commit> are new and no review has seen them:
> give them a full first pass, should-fix and optional included. They were
> built from the brief at <brief path>: mark any finding whose fix would
> undo something it chose on purpose, or go past what it was asked to do.
> Findings the log already held before them stay as they are.

For a review that follows a fix, the arguments are instead:

> This follows a fix of: <each id just attempted, with the model that
> tried it>. Settle those under the same ids. Anything the fix broke is
> that finding recurring, under its id, not a new finding. The brief is
> <brief path>.

When it returns, read the last `## Review` entry in
`docs/reviews/open.md` yourself, and sort what it lists whose id is not
an earlier finding:
- **Chaseable**: every finding, must, should or optional — new, still
  open or recurring — that is not closed and not marked `plan's choice`
  or `past the request`.
- **Not chased**: findings marked `plan's choice` or `past the request`.
  Never send them to a fix. Keep them for the report.
- **Closed**: findings the entry closes after Fable's attempt ("Fable
  could not fix this"). Keep them for the report.

Then:
- **A closed must- or should-fix finding** → the run **stops**: Fable
  could not fix it, so the plan has to change.
- **A must-fix finding marked `plan's choice` or `past the request`** →
  the run **stops**: the plan chose something that must not stand.
- **Nothing chaseable left** → go to "A clean finish". Closed optional
  findings and not-chased should-fix or optional findings do not stop it.
- **Otherwise** → go to step 4.

A reviewer's "leave it" or "stop fixing" on a finding that Fable has not
yet tried stops nothing: that finding goes to Fable in step 4, and the
remark goes into its story.

## 4. Fix

A round is one fix followed by one review. **After five rounds the run
stops**, whatever is left.

Sort the chaseable findings by who tries. There is no other case: a
finding Fable has tried is resolved or closed.
- **Not yet attempted**: the model the finding's line names after
  `first try:` (`opus` or `fable`), otherwise `sonnet`.
- **Attempted once, not by Fable, and still there or did harm**
  (recurring): `fable`. Never `opus` for a second attempt, never a second
  `fable`.

For each model that has findings, in the order `sonnet`, `opus`,
`fable`, one helper at a time:

Command: `do-fix`, with that model's finding ids, separated by spaces,
as its arguments.

**For a second attempt, write the story into the prompt.** Before
starting the `fable` helper, gather for each recurring id, from
`docs/reviews/open.md` and `git log`: every earlier attempt at it (the
model, its attempt line, and what its commit changed: find the commit
with `git log -S "## Fix attempt <n> —" --format=%h -- docs/reviews/open.md`
and read `git show --stat <commit>` and the diff of the files the
finding names); every review line about it after each attempt, and, in a
log written before this rule, any line marked "caused by fix" that names
the same file and code; and every example (an activity text, an input, a
case) named in any of those lines, with the answer it must give. Add to
the prompt, for each such id:

> This is the second and last attempt at <id>. What was tried:
> <attempt by attempt: the model, what it changed, what the next review
> said was still wrong or broken>. What the reviewers said, word for
> word: <the remarks, including any "leave it" or "stop fixing">. The
> examples, each with the answer it must give: <the list>. Keep every
> one of them as a test with that answer; a fix that changes any of
> those answers has failed. Fix the cause, not the last example. If it
> cannot be done well, change no app code and say so in your attempt
> entry with your reasons; that is your attempt.

When each helper returns, check: `git log --oneline -1` shows its commit,
and `docs/reviews/open.md` ends with its `## Fix attempt` entry. If there
is no commit, the run **stops**: the fix could not pass the checks.

Note which findings were attempted and on which model; the report needs
it. Then go back to step 3.

## A clean finish

1. `git branch --show-current` must say `dev`. If it does not, stop and
   say so; push nothing.
2. `git push origin dev`. Never any other branch, never `--force`.
3. Write the report (below). Ask the owner nothing: every chaseable
   finding, optional included, is fixed or closed, and the push is the
   run's only one.

## When the run stops

Push nothing. Leave everything as the helpers left it. Write the report,
and end it with the stop account: what is still open (ids, one line
each), why the run stopped (a must- or should-fix finding Fable could
not fix, a must-fix finding marked as the plan's choice or past the
request, five rounds used with chaseable findings left, a build or a fix
with no commit, or a branch that was not `dev`), and the one command to
run by hand next, with the model to switch to: `/do-plan` again for the
first two; otherwise `/do-fix <ids>` on the model the ladder names
(Sonnet or the named first try for a first attempt, Fable for a second),
or `/do-review`.

## The report

Short, plain language, in this order:
- **Decided for you**: the plan's `GUESSES THE OWNER WOULD NOTICE`,
  one plain line each saying what was chosen and what the other choice
  was, so the owner can reverse one after trying the `dev` preview; or
  "nothing".
- **Built**: what the change is, in two lines, and the brief's path.
- **Rounds**: how many reviews and how many fixes.
- **Fixed**: each finding fixed, one line, and the model that fixed it.
  Mark the ones that needed Fable's second attempt.
- **Fable could not fix this**: each finding closed after Fable's
  attempt, one line each: its group, what is still wrong, and Fable's
  reason if it said it cannot be done well. A must- or should-fix one
  is also why the run stopped. Or "nothing".
- **Not chased — for you to decide**: each finding marked as the
  plan's choice or past the request, one line each: which of the two,
  what the reviewer found, and what the brief chose or left out. Or
  "nothing".
- **Guessed without asking**: the plan's `GUESSES THE OWNER WOULD NOT
  NOTICE`, one line each, or "nothing".
- **Left from before this run**: the earlier findings, ids only, untouched.
- **Not checked**: what the last review said it did not check.
- **Pushed**: yes, with the commit, and that the `dev` preview is the
  place to try it; or no, and why.
- then, if the run stopped, the stop account.

## Never

- Never commit to, push to, or merge into `main`. Merging is the owner's,
  asked for in words.
- Never push when the run stopped early.
- Never push before at least one review has run in this run.
- Never edit, commit or stage anything yourself; only helpers change files.
- Never run two helpers at once: they share one working tree and one log.
- Never send an earlier finding to a fix.
- Never send a finding marked `plan's choice` or `past the request` to a
  fix.
- Never give a finding an Opus attempt after a failed one, or a second
  Fable attempt.
- Never rename or delete `docs/reviews/open.md`.
