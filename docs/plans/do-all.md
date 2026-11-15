# /do-all: one line after thinking, and the rest runs by itself

> **BUILT - do not run again.** Built on 2026-11-14 in the commit titled "feat: /do-all runs plan, build, review and fix from one line". It stays as the record of what was asked.

## Goal

After `/do-think`, the owner pastes one line and walks away. The plan, the
build, the review and the fixes run one after another, each by a fresh
helper on the model the step before it named, until a review finds nothing
that must or should be fixed. A clean run is pushed to `dev`; a run that
could not get there stops and says plainly where and why.

## How it works (read this before the steps)

`/do-all` is a new command file. The session that runs it does no planning,
building, reviewing or fixing of its own. It starts one helper at a time
with the Agent tool, tells that helper to read one of the existing command
files (`do-plan.md`, `do-build.md`, `do-review.md`, `do-fix.md`) and follow
it, and reads what comes back. That is why the four existing commands do
not change: the new command only calls them.

The brakes the owner asked for already exist in `/do-review`: a finding
that comes back after a fix is marked recurring with a stronger model
named (Sonnet → Opus → Fable), and one that comes back again, or was
already tried by Fable, is marked "stop fixing". `/do-all` obeys those
marks. It adds only the limit of five rounds.

The review log (`docs/reviews/open.md`) covers everything on `dev`, and it
already holds should-fix findings from earlier work. `/do-all` notes those
before it starts and leaves them alone: it loops only on findings that
appeared during its own run.

## Files

- `.claude/commands/do-all.md`: **new**. The whole command; its text is
  given word for word in step 2.
- `.claude/commands/do-think.md`: the handover line becomes a `/do-all`
  line (three small edits, step 3).
- `docs/FLOW.md`: the Think row, the "When to think first" paragraph, a new
  section "Letting it run", and one line under "Rules that never change"
  (step 4). `/do-help` prints this file, which is how `/do-help` shows the
  new command; `.claude/commands/do-help.md` itself does not change.
- `docs/plans/README.md`: step 0, a new paragraph, and the sentence listing
  the command names (step 5).
- `CLAUDE.md`: the second standing exception, in the branches section
  (step 6).

No file under `src/` changes.

## Steps

1. `git branch --show-current`; if it is not `dev`, `git switch dev`.

2. Create `.claude/commands/do-all.md` with exactly this content (the four
   backticks around it are not part of the file):

````
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
````

3. In `.claude/commands/do-think.md`, three edits:
   - Replace `This is a conversation, and it comes before `/do-plan`.`
     with `This is a conversation, and it comes before any plan.`
   - In step 5, replace the bullet
     ```
        - **The line to run next**, in a code block, ready to paste:
          `/do-plan <one paragraph that carries everything we agreed, the
          limits, and what done looks like>`
     ```
     with
     ```
        - **The line to run next**, in a code block, ready to paste:
          `/do-all <one paragraph that carries everything we agreed, the
          limits, and what done looks like>`
     ```
   - Replace
     ```
        Then stop. Do not run `/do-plan` yourself and do not start planning,
        even if I say "great" or "go ahead": tell me to paste the line.
     ```
     with
     ```
        Then stop. Do not run `/do-all` or `/do-plan` yourself and do not
        start planning, even if I say "great" or "go ahead": tell me to
        paste the line.
     ```
   Change nothing else in the file, including its front matter.

4. In `docs/FLOW.md`:
   - In the table, the Think row's last cell `handing you a `/do-plan` line
     to paste` becomes `handing you a `/do-all` line to paste`.
   - Under "When to think first", replace `and ends with a ready `/do-plan`
     line. It writes nothing. Paste that line **in the same chat**: the
     conversation is exactly what the planner should know.` with `and ends
     with a ready `/do-all` line. It writes nothing. Paste that line **in
     the same chat**.`
   - Insert this new section directly before `## What to do after a review`:
     ```
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
     ```
   - Under "Rules that never change", replace `- `/do-build` and `/do-fix`
     commit by themselves. Nothing pushes until you type `push`.` with
     `- `/do-build` and `/do-fix` commit by themselves. Nothing pushes
     until you type `push`, except `/do-all`, which pushes `dev` when its
     run finishes clean.`
   - Directly under the line `**Two reviews per change at most.** After
     that the phone is the better judge.` add a new paragraph: `That is
     for doing it by hand. `/do-all` has its own limit of five rounds.`

5. In `docs/plans/README.md`:
   - In step 0, replace `ends with a `/do-plan` line to paste in the same
     session.` with `ends with a `/do-all` line to paste in the same
     session.`
   - Insert a new paragraph directly before the paragraph that begins `Do
     not use Plan mode for step 1.`:
     ```
     `/do-all <the paragraph from /do-think>` runs steps 1 to 4 by itself,
     each with a fresh helper on the model the step before named, until a
     review finds nothing that must or should be fixed. A clean run is
     pushed to `dev`; a run that stops early is not. `docs/FLOW.md` says
     when it stops.
     ```
   - Replace `The commands are named `/do-think`, `/do-plan`, `/do-build`,
     `/do-review` and `/do-fix` on purpose.` with `The commands are named
     `/do-think`, `/do-all`, `/do-plan`, `/do-build`, `/do-review` and
     `/do-fix` on purpose.`

6. In `CLAUDE.md`, in the section "Branches: work on `dev`, never push to
   `main`", the second bullet ends with the sentence `` `/do-fix` does the
   same for the fixes it makes. `` Add directly after it, in the same
   bullet:
   ```
   A second standing exception: `/do-all` pushes `dev` to `origin dev` by
   itself when its run ends with nothing left that must or should be
   fixed, so the preview is ready to try. A run that stopped early does
   not push. It never touches `main`.
   ```
   Change nothing else in `CLAUDE.md`.

7. Run the checks under "Done when".

8. Commit on `dev` as `/do-build` says, staging by name:
   `.claude/commands/do-all.md`, `.claude/commands/do-think.md`,
   `docs/FLOW.md`, `docs/plans/README.md`, `CLAUDE.md` and this brief.
   Suggested first line: `feat: /do-all runs plan, build, review and fix
   from one line`. Do not push.

## Rules that apply

- Branches: work on `dev`; never commit to, push to or merge into `main`.
  `/do-build` commits to `dev` once its checks pass and does not push.
- `main` changes only when the owner names the merge in that conversation.
  Nothing in the new command may weaken that.
- The repository is public: nothing private goes into a command, a brief
  or the review log.

## Do not

- Do not change `.claude/commands/do-plan.md`, `do-build.md`,
  `do-review.md`, `do-fix.md` or `do-help.md`.
- Do not change anything under `src/`, `scripts/` or `supabase/`.
- Do not stage or commit `docs/reviews/open.md`: it holds uncommitted
  review entries that are not part of this build.
- Do not touch `.claude/settings.local.json` or add permissions.
- Do not run `/do-all` to try it. It would plan and build a real change.
- Do not reword the text given for `do-all.md`. If something in it looks
  wrong, stop and say what.
- Do not add a test for the command files: they are instructions, and
  nothing in the test suite reads them.

## Done when

- `ls .claude/commands/` lists `do-all.md` beside the six existing files.
- `grep -c "do-all" .claude/commands/do-think.md` prints `2`, and
  `grep -c "do-plan" .claude/commands/do-think.md` prints `1`.
- `grep -n "do-all" docs/FLOW.md docs/plans/README.md CLAUDE.md` prints at
  least one line for each of the three files.
- `git diff HEAD --stat -- .claude/commands/do-plan.md
  .claude/commands/do-build.md .claude/commands/do-review.md
  .claude/commands/do-fix.md .claude/commands/do-help.md` prints nothing.
- `git status --short` after the commit shows only
  ` M docs/reviews/open.md`.
- `npx tsc --noEmit` clean; `npm test` at 1144 passed, 13 skipped;
  `npm run lint` at 0 errors and 54 warnings; `npm run build` succeeding.
  None should move: no code changed.
- Nothing to look at in the app. The real proof is the owner's first
  `/do-all` run, after reloading the window (⌘⇧P → `Reload Window`) so the
  new command is picked up.

## Not decided

- **The name.** `/do-all` is proposed: it does all the steps. If the owner
  wants another, it is a file rename and the mentions in the four
  documents above.
- Three choices the handed-over paragraph did not settle, made here and
  easy to change in `do-all.md`:
  1. Findings already in the review log before a run are left alone; the
     run loops only on its own. (There are three such should-fix findings
     today, one of them waiting for the owner to read lines.)
  2. The last review's log entry is left uncommitted, as it is when the
     steps are done by hand; only builds and fixes commit.
  3. When a plan says "no review needed", the run pushes after the build
     and says nothing was reviewed.

## Who should build and review this

- *Build with* **Sonnet**: every edit is given word for word, but there
  are five files and a long new one to place exactly.
- *Review with* **Opus**: the new command commits and pushes without the
  owner, so its wording against the branch rules is worth a careful read;
  it stays on `dev` and touches no app code, so Fable is not needed.
- *Effort*: medium.
