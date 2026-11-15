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
4. If `docs/reviews/open.md` exists, read its last `## Review` entry and
   note the id of every must-fix or should-fix finding it does not list as
   resolved. These are the **earlier findings**. They are not this run's:
   never send them to a fix, and never count them when deciding whether
   the run is clean.

## 1. Plan

Model: `opus`. Use `fable` if the request touches sign-in, deleting or
exporting data, payments, reminders, or the shape of the database.

Command: `do-plan`, with the request above as its arguments. Add to the
prompt:

> You cannot ask the owner anything. If step 2 of the command would have
> you ask, do not write the brief: reply with `QUESTIONS:` and the
> questions, in plain language. Otherwise save the brief, and end your
> reply with `GUESSES:` followed by every choice you made that the request
> did not settle, or `GUESSES: none`.

When it returns, read the brief it saved.

**Stop and ask the owner** if the helper returned questions, if it listed
any guess, or if the brief's "Not decided" part says anything other than
"nothing". Put the questions to the owner in plain language, one message,
and wait. When they are answered, start a new plan helper with the
original request followed by "The owner has since settled: <the answers>.
Replace the brief at <path>." Repeat until a brief comes back with no
questions, no guesses and nothing undecided.

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

If the brief says "no review needed", go to "A clean finish" and say in
the report that nothing was reviewed.

## 3. Review

Model: the one the brief names for the review. Effort: the one the brief
names.

Command: `do-review`, with these arguments:

> The commits after <starting commit> are new and no review has seen them:
> give them a full first pass, should-fix and optional included. Findings
> the log already held before them stay as they are.

For a review that follows a fix, the arguments are instead:

> This follows a fix of: <the ids just attempted>. Settle those, and look
> for harm the fix did.

When it returns, read the last `## Review` entry in
`docs/reviews/open.md` yourself. From it, list **this run's findings**:
every must-fix or should-fix line (new, still open or recurring) whose id
is not one of the earlier findings.

- **None left** → go to "A clean finish".
- **Any marked "stop fixing"** → the run **stops**.
- **Otherwise** → go to step 4.

## 4. Fix

A round is one fix followed by one review. **After five rounds the run
stops**, whatever is left.

Sort this run's findings by who should try:
- a finding nobody has attempted: the model the review's "Next step" names
  for `/do-fix`, or `sonnet` if it names none;
- a recurring finding: the stronger model the review names after "next:".

For each model that has findings, weakest first, one helper at a time:

Command: `do-fix`, with that model's finding ids, separated by spaces, as
its arguments.

When each returns, check: `git log --oneline -1` shows its commit, and
`docs/reviews/open.md` ends with its `## Fix attempt` entry. If there is
no commit, the run **stops**: the fix could not pass the checks.

Note which findings were attempted and on which model; the report needs
it. Then go back to step 3.

## A clean finish

1. `git branch --show-current` must say `dev`. If it does not, stop and
   say so; push nothing.
2. `git push origin dev`. Never any other branch, never `--force`.
3. Write the report (below). It ends by listing this run's optional
   findings and asking: "Carry on with the optional ones?"
4. If the owner says yes: one fix helper on `sonnet` with those ids, then
   step 3 again. The same limits apply, the rounds keep counting from
   where they were, and a clean finish pushes again.

## When the run stops

Push nothing. Leave everything as the helpers left it. Write the report,
and in place of the question about optional findings say: what is still
open (ids, one line each), why the run stopped (a finding marked "stop
fixing", five rounds used, a build or a fix with no commit, or a branch
that was not `dev`), and the one command to run by hand next, with the
model to switch to: `/do-plan` again when a finding says stop fixing,
`/do-fix <ids>` or `/do-review` otherwise.

## The report

Short, plain language, in this order:
- **Built**: what the change is, in two lines, and the brief's path.
- **Rounds**: how many reviews and how many fixes.
- **Fixed**: each finding fixed, one line, and the model that fixed it.
  Mark the ones that needed a second, stronger model.
- **Left from before this run**: the earlier findings, ids only, untouched.
- **Not checked**: what the last review said it did not check.
- **Pushed**: yes, with the commit, and that the `dev` preview is the
  place to try it; or no, and why.
- then the optional findings and the question, or the stop account.

## Never

- Never commit to, push to, or merge into `main`. Merging is the owner's,
  asked for in words.
- Never push when the run stopped early.
- Never edit, commit or stage anything yourself; only helpers change files.
- Never run two helpers at once: they share one working tree and one log.
- Never send an earlier finding to a fix.
- Never rename or delete `docs/reviews/open.md`.
