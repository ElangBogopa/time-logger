# A finding is not given up on until Fable has tried it once

> **BUILT - do not run again.** Built on 2026-11-16 in the commit titled "Fable gets one last try at every finding before it is closed". It stays as the record of what was asked.

## Goal

`/do-all`, `/do-review` and `/do-fix` stop trading one error for another.
Every real flaw a review finds, optional ones included, is chased: first by
Sonnet (or the stronger model the review names for a first try), then, if
the next review says it is still there or the fix did harm, once by Fable,
handed the whole story. Then it is fixed or closed. `/do-all` asks the
owner nothing at the end and pushes `dev` once, when every chaseable
finding is fixed or closed. A finding that goes against what the plan chose
on purpose, or past what the request asked, is never fixed: it is reported
for the owner. No app code changes.

## Why (read this before the steps)

In the run of 2026-11-16 (Heart counts time with friends or family,
`docs/reviews/open.md`, reviews 2 to 5) one stretch of
`src/lib/metrics-calc.ts` took four fix rounds. Sonnet twice and Opus once
each traded one error for another; each round's damage was logged under a
new id ("caused by fix"), so nothing looked recurring and the ladder never
climbed. It was fixed in one attempt only when the owner asked by hand for
Fable and the prompt carried the full history and every example. Review 1
also logged `matcher-needs-with` "(as the plan decided)" as an ordinary
optional finding, and a fix then undid the plan's choice. This change makes
those three things impossible by rule.

## The rules, in one place (the builder writes these into the files below)

1. **Chaseable** = any finding, must, should or optional, that is not an
   earlier finding (from before a `/do-all` run), not resolved, not closed,
   and not marked `plan's choice` or `past the request`.
2. **Marks.** A review marks a finding `plan's choice` when fixing it would
   undo something the brief chose on purpose, and `past the request` when
   fixing it would go beyond what the brief was asked to do. A marked
   finding is never sent to a fix, by `/do-all` or by `/do-fix`. It is
   reported for the owner to decide. Exception, decided here: a **must-fix**
   finding that is marked stops `/do-all` unpushed with "plan again"
   (`/do-plan`), because must-fix means a person would notice harm, data is
   at risk or a check fails, and that should not reach the preview as the
   plan's choice.
3. **Ladder.** First attempt: Sonnet, unless the review's line for that
   finding names a stronger first try (`first try: Opus` or
   `first try: Fable`). If the next review says the finding is still there,
   or that the fix did harm, the second attempt is Fable, once. No Opus
   step after a failure, no second Fable attempt, never Haiku. A finding
   whose Fable attempt failed (first or second) is **closed**.
4. **Harm from a fix is the same finding.** Whatever a fix broke, wherever
   it shows, is logged as that finding **recurring**, under the same id —
   never as a new finding "caused by fix". Its group becomes the higher of
   the two (an optional finding whose fix broke something a person would
   notice is now must). When one fix attempt covered several ids, the
   reviewer assigns the harm to the id whose change caused it, from the
   commit's diff.
5. **After Fable fails.** Must or should: closed, and `/do-all` stops,
   pushes nothing, and tells the owner to plan again. Optional: closed,
   reported as "Fable could not fix this", and the run carries on and can
   still push.
6. **"Leave it" does not cancel Fable's turn.** A reviewer may say a
   finding is not worth another round; that remark goes in the log line and
   in Fable's story, and the line still says `next: Fable`. Fable answering
   that it cannot be done well, with reasons and no app code change, is its
   attempt; the next review then closes the finding.
7. **The story.** Every second attempt is handed: each earlier attempt's
   model and what it changed (its log line, and the gist of its commit's
   diff), what the next review said was still wrong or broken, the
   reviewer's remarks word for word (including any "leave it"), and every
   example named in any review or attempt line for that finding, each with
   the answer it must give — with the instruction that each is kept as a
   test with that answer. In `/do-all` the conductor writes this into the
   Fable helper's prompt; `/do-fix` run by hand on a second attempt gathers
   it itself from `docs/reviews/open.md` and `git log`. An attempt's commit
   is found with
   `git log -S "## Fix attempt <n> —" --format=%h -- docs/reviews/open.md`
   (the log says "commit pending", because the entry is written before the
   commit). In a log written before this change, lines marked "caused by
   fix" that name the same file and code belong to the story too.
8. **Five rounds** stays exactly as written. A run that uses them with
   chaseable findings left (optional included) stops unpushed.
9. **By hand, the same advice.** `/do-review`'s "Next step" follows the
   same ladder and rule 4; it lists optional chaseable findings too, says
   which are optional, and names marked ones as the owner's. The owner
   still chooses whether to run `/do-fix`.

## Files

- `.claude/commands/do-all.md` — step 0.4 (earlier findings of every
  group), step 3 (review arguments name the brief; sorting into chaseable,
  not chased, closed; new stop conditions), step 4 (ladder, the story
  prompt), "A clean finish" (no question, one push), "When the run stops"
  (new reasons), "The report" (two new lists), "Never" (two lines).
- `.claude/commands/do-review.md` — section 2 (read the brief), section 3
  (all groups, closed state, ladder, harm-from-fix, "leave it"), section 4
  (marks, first try, narrower second pass), section 5 (log line shapes,
  reply, Next step).
- `.claude/commands/do-fix.md` — step 3 (marked, closed, second attempt and
  its story), steps 4, 6 and 7 (examples as tests, "cannot be done well",
  log-only commit).
- `docs/reviews/README.md` — the ladder bullet and the format example.
- `docs/FLOW.md` — what `/do-help` prints: "Letting it run", "What to do
  after a review", "Shortcuts", "Rules that never change".
- `docs/plans/README.md` — step 4 and the `/do-all` paragraph.
- `CLAUDE.md` — "Branches", the `/do-all` standing exception only.

## Steps

### 1. `.claude/commands/do-all.md`

1a. **Step 0, item 4.** Replace it with:

> 4. If `docs/reviews/open.md` exists, read it and note the id of every
>    finding, of any group — must, should or optional — that no `## Review`
>    entry lists as resolved or closed. These are the **earlier findings**.
>    They are not this run's: never send them to a fix, and never count
>    them when deciding whether the run is clean.

1b. **Step 3, the two argument blocks.** Replace the first with:

> The commits after <starting commit> are new and no review has seen them:
> give them a full first pass, should-fix and optional included. They were
> built from the brief at <brief path>: mark any finding whose fix would
> undo something it chose on purpose, or go past what it was asked to do.
> Findings the log already held before them stay as they are.

and the second with:

> This follows a fix of: <each id just attempted, with the model that
> tried it>. Settle those under the same ids. Anything the fix broke is
> that finding recurring, under its id, not a new finding. The brief is
> <brief path>.

1c. **Step 3, from "When it returns, read the last" to the end of the
bullet list.** Replace with:

> When it returns, read the last `## Review` entry in
> `docs/reviews/open.md` yourself, and sort what it lists whose id is not
> an earlier finding:
> - **Chaseable**: every finding, must, should or optional — new, still
>   open or recurring — that is not closed and not marked `plan's choice`
>   or `past the request`.
> - **Not chased**: findings marked `plan's choice` or `past the request`.
>   Never send them to a fix. Keep them for the report.
> - **Closed**: findings the entry closes after Fable's attempt ("Fable
>   could not fix this"). Keep them for the report.
>
> Then:
> - **A closed must- or should-fix finding** → the run **stops**: Fable
>   could not fix it, so the plan has to change.
> - **A must-fix finding marked `plan's choice` or `past the request`** →
>   the run **stops**: the plan chose something that must not stand.
> - **Nothing chaseable left** → go to "A clean finish". Closed optional
>   findings and not-chased should-fix or optional findings do not stop it.
> - **Otherwise** → go to step 4.
>
> A reviewer's "leave it" or "stop fixing" on a finding that Fable has not
> yet tried stops nothing: that finding goes to Fable in step 4, and the
> remark goes into its story.

1d. **Step 4, from "Sort this run's findings by who should try:" to
"Note which findings were attempted ...".** Keep the round paragraph above
it (`A round is one fix followed by one review. **After five rounds the
run stops**, whatever is left.`) exactly as it is. Replace the rest of the
step with:

> Sort the chaseable findings by who tries. There is no other case: a
> finding Fable has tried is resolved or closed.
> - **Not yet attempted**: the model the finding's line names after
>   `first try:` (`opus` or `fable`), otherwise `sonnet`.
> - **Attempted once, not by Fable, and still there or did harm**
>   (recurring): `fable`. Never `opus` for a second attempt, never a second
>   `fable`.
>
> For each model that has findings, in the order `sonnet`, `opus`,
> `fable`, one helper at a time:
>
> Command: `do-fix`, with that model's finding ids, separated by spaces,
> as its arguments.
>
> **For a second attempt, write the story into the prompt.** Before
> starting the `fable` helper, gather for each recurring id, from
> `docs/reviews/open.md` and `git log`: every earlier attempt at it (the
> model, its attempt line, and what its commit changed: find the commit
> with `git log -S "## Fix attempt <n> —" --format=%h -- docs/reviews/open.md`
> and read `git show --stat <commit>` and the diff of the files the
> finding names); every review line about it after each attempt, and, in a
> log written before this rule, any line marked "caused by fix" that names
> the same file and code; and every example (an activity text, an input, a
> case) named in any of those lines, with the answer it must give. Add to
> the prompt, for each such id:
>
> > This is the second and last attempt at <id>. What was tried:
> > <attempt by attempt: the model, what it changed, what the next review
> > said was still wrong or broken>. What the reviewers said, word for
> > word: <the remarks, including any "leave it" or "stop fixing">. The
> > examples, each with the answer it must give: <the list>. Keep every
> > one of them as a test with that answer; a fix that changes any of
> > those answers has failed. Fix the cause, not the last example. If it
> > cannot be done well, change no app code and say so in your attempt
> > entry with your reasons; that is your attempt.
>
> When each helper returns, check: `git log --oneline -1` shows its commit,
> and `docs/reviews/open.md` ends with its `## Fix attempt` entry. If there
> is no commit, the run **stops**: the fix could not pass the checks.
>
> Note which findings were attempted and on which model; the report needs
> it. Then go back to step 3.

1e. **"A clean finish".** Replace steps 3 and 4 with one step:

> 3. Write the report (below). Ask the owner nothing: every chaseable
>    finding, optional included, is fixed or closed, and the push is the
>    run's only one.

1f. **"When the run stops".** Replace the paragraph with:

> Push nothing. Leave everything as the helpers left it. Write the report,
> and end it with the stop account: what is still open (ids, one line
> each), why the run stopped (a must- or should-fix finding Fable could
> not fix, a must-fix finding marked as the plan's choice or past the
> request, five rounds used with chaseable findings left, a build or a fix
> with no commit, or a branch that was not `dev`), and the one command to
> run by hand next, with the model to switch to: `/do-plan` again for the
> first two; otherwise `/do-fix <ids>` on the model the ladder names
> (Sonnet or the named first try for a first attempt, Fable for a second),
> or `/do-review`.

1g. **"The report".** Change three bullets and add two:
- **Fixed**: change `Mark the ones that needed a second, stronger model.`
  to `Mark the ones that needed Fable's second attempt.`
- Directly after **Fixed**, add:
  > - **Fable could not fix this**: each finding closed after Fable's
  >   attempt, one line each: its group, what is still wrong, and Fable's
  >   reason if it said it cannot be done well. A must- or should-fix one
  >   is also why the run stopped. Or "nothing".
  > - **Not chased — for you to decide**: each finding marked as the
  >   plan's choice or past the request, one line each: which of the two,
  >   what the reviewer found, and what the brief chose or left out. Or
  >   "nothing".
- Replace the last bullet (`- then the optional findings and the
  question, or the stop account.`) with `- then, if the run stopped, the
  stop account.`

1h. **"Never".** Add two lines after `- Never send an earlier finding to a
fix.`:
> - Never send a finding marked `plan's choice` or `past the request` to a
>   fix.
> - Never give a finding an Opus attempt after a failed one, or a second
>   Fable attempt.

Change nothing else in `do-all.md`: the start, step 0 items 1–3, step 1,
step 2, "How to start a helper", the five-round sentence, the push step,
and the other "Never" lines stay word for word.

### 2. `.claude/commands/do-review.md`

2a. **Section 2.** Add, as a new item 1 (renumber the rest):

> 1. Read the brief this work was built from: the one the arguments name,
>    or else every file under `docs/plans/` that
>    `git diff --name-only origin/main...dev` lists. Note what it chose on
>    purpose (its Goal, its decisions, "Do not") and what it was asked to
>    do. Section 4 needs it.

2b. **Section 3.** Replace the whole section body with:

> For every finding in the log, of any group — must, should or optional —
> that is not already resolved, closed or marked (section 4), decide by
> looking at the code, not at what a fix claimed:
> - **Resolved** — the problem is gone, and the fix did no harm.
> - **Still open** — nobody has attempted it.
> - **Recurring** — a fix was attempted and the problem is still there,
>   moved somewhere else, or the fix broke something. Whether a problem is
>   "the same one" is your judgment; match on what goes wrong, not on
>   wording. **Anything a fix broke is the finding that fix was for,
>   continuing, under its id** — never a new finding "caused by fix".
>   Say on the line what it broke, with the examples. If the harm is worse
>   than the finding, raise the finding's group to match. If one attempt
>   covered several ids, give the harm to the one whose change caused it,
>   from the commit's diff.
> - **Closed** — Fable attempted it (first or second try) and it is still
>   there or did harm, or Fable answered that it cannot be done well.
>   It is never attempted again.
>
> Who tries a recurring finding next, from the attempts the log records:
> - attempted once by Sonnet, Haiku or Opus → **next: Fable**, once, handed
>   the story (`/do-fix` says what that is);
> - attempted by Fable → **closed**. A closed must- or should-fix finding
>   means the plan or the approach is wrong: say what to rethink and
>   recommend `/do-plan`. A closed optional finding reads "Fable could not
>   fix this" and is left for the owner.
>
> There is no Opus step after a failure and no second Fable attempt. If
> you think a recurring finding is not worth another round, say so on its
> line — it goes to Fable with the story — but the line still says
> `next: Fable`. Only Fable's own attempt ends a finding's chase.

2c. **Section 4.** After the paragraph that ends `When unsure between two
groups, pick the lower and say why in a clause.`, add:

> Then mark it if it is not a flaw to chase:
> - **plan's choice** — fixing it would undo something the brief chose on
>   purpose. Say what the brief chose.
> - **past the request** — fixing it would go beyond what the brief was
>   asked to do.
> A marked finding is never sent to a fix; it is the owner's to decide.
> Mark only what the brief plainly settles or plainly leaves out; a flaw
> in how the brief's choice was built is not the brief's choice.
>
> A new finding gets its first attempt from Sonnet. If the fix needs
> judgment Sonnet is unlikely to bring — a tangle where the obvious fix
> trades one error for another — name a stronger first try on its line:
> `first try: Opus` or `first try: Fable`.

Then replace the paragraph that begins `**On a second or later pass, be
narrower.**` up to `is how a review never ends.` with:

> **On a second or later pass, be narrower.** Report new findings only if
> they are must-fix. What a fix broke is not new: it is the finding the
> fix was for, recurring (section 3). Do not go looking for fresh
> should-fix or optional items in work an earlier pass already covered:
> that is how a review never ends.

Keep the sentence after it (`If this is the third pass or more, ...`).

2d. **Section 5.** After `Keep it short: one line per finding.`, add:

> Line shapes (`docs/reviews/README.md` has an example):
> - `- <group> · <id> · <file:line> · <what goes wrong>` — add
>   ` · first try: Opus` or ` · first try: Fable` where section 4 says;
> - `- <group> · plan's choice · <id> · <file:line> · <what> · the brief chose <what>`,
>   and likewise `past the request`;
> - `- still open · <group> · <id>`;
> - `- recurring · <group> · <id> · tried once by <model> · <what is still wrong, or what the fix broke, with examples> · next: Fable`;
> - `- closed · <group> · <id> · Fable could not fix this · <what is still wrong, or Fable's reason>`;
> - `- resolved: <ids>`.

In the reply list:
- **Earlier findings**: change the text to `only if there were any:
  resolved (ids, one line), still open, recurring — each with who tried
  and "next: Fable" — and closed.`
- After the **Should fix** / **Optional** bullet, add:
  `- **Not chased**: each finding marked plan's choice or past the request,
  one line, for the owner to decide. "None." if none.`
- Replace the **Next step** bullet with:
  > - **Next step**, one line, following the ladder: `/do-fix <ids>` on
  >   Sonnet (or the first try a line names) for findings not yet
  >   attempted, and `/do-fix <ids>` on Fable for recurring ones —
  >   must and should first, then optional, saying which are optional;
  >   `/do-plan` when a must- or should-fix finding is closed; or "push
  >   and try it on a phone", or "ready for the owner to say merge". Never
  >   Opus for a second attempt. Marked findings are named as the owner's,
  >   not as something to fix. The owner chooses whether to run any of it.

### 3. `.claude/commands/do-fix.md`

3a. **Step 3.** Keep the first bullet (a stronger model recommended) as it
is. Replace the other two bullets with:

> - If it is marked `plan's choice` or `past the request`, do not attempt
>   it, whoever asks in the arguments: say it is the owner's to decide.
> - If it is closed ("Fable could not fix this"), do not attempt it. If it
>   is must or should, say it needs `/do-plan`.
> - If it was attempted before, this is its second and last attempt, and
>   the ladder gives it to Fable. If you are not Fable, say so in one line
>   and leave it unless the owner tells you to go on. Before touching
>   anything, gather its story, unless your prompt already gives it:
>   every earlier attempt at it (the model, its attempt line, and what its
>   commit changed — find the commit with
>   `git log -S "## Fix attempt <n> —" --format=%h -- docs/reviews/open.md`,
>   then `git show <commit>`); every review line about it after each
>   attempt, including "leave it" remarks and, in a log written before
>   this rule, lines marked "caused by fix" that name the same file and
>   code; and every example named in any of those lines, with the answer
>   it must give. Do something different from every earlier attempt.

3b. **Step 4.** After `Add or change a test that would have caught it,
where one can be written.` add: `On a second attempt, every example from
its story is a test with its correct answer, and none of them may change
answer.` Then add a new sentence: `If, on a second attempt, it cannot be
done well, change no app code and say so, with your reasons, in the
attempt entry: that answer is your attempt.`

3c. **Step 6.** Change `whether you believe it is fixed, partly fixed, or
not fixed` to `whether you believe it is fixed, partly fixed, not fixed,
or cannot be done well (with the reasons)`.

3d. **Step 7.** After `plus the log.` add: `If only the log changed (you
answered that it cannot be done well), commit the log alone.`

### 4. `docs/reviews/README.md`

- Replace the bullet `- A finding that comes back after an attempt is
  **recurring** ... Sonnet → Opus → Fable → stop and re-plan.` with:
  > - A finding that comes back after an attempt, or whose fix broke
  >   something, is **recurring**, under the same id: harm from a fix is
  >   never a new finding. The first attempt is Sonnet (or a stronger first
  >   try the review names); the second is Fable, once, handed the story
  >   of the earlier attempts and every example as a test. If Fable fails,
  >   the finding is **closed**: a must- or should-fix one means re-plan,
  >   an optional one is left for the owner.
  > - A finding whose fix would undo what the plan chose on purpose, or go
  >   past what it was asked, is marked `plan's choice` or
  >   `past the request` and is never sent to a fix.
- In the format example, keep it as it is but add one line to Review 1,
  `- optional · plan's choice · matcher-needs-with · src/lib/metrics-calc.ts:183 · only a people word after "with" counts · the brief chose "with" only`,
  change Review 2's recurring line to end `· next: Fable`, and add after
  it a third entry:
  ```
  ## Fix attempt 2 — 2026-11-15 — Fable 5.2 — commit <short commit id>
  - stale-google-token · the banner reads the refreshed state; every example from reviews 1 and 2 kept as a test · believes: fixed

  ## Review 3 — 2026-11-16 — Opus 5.5 — reviewed <short commit id>
  Verdict: Not ready (1 must fix)
  - closed · must · stale-google-token · Fable could not fix this · the banner clears, but the calendar now loads twice · re-plan
  ```

### 5. `docs/FLOW.md`

- "Letting it run", first paragraph: replace `goes round until a review
  finds nothing that must or should be fixed. Then it pushes `dev` and
  asks whether to carry on with the optional findings.` with `goes round
  until every finding a review made — optional ones included — is fixed
  or closed. Then it pushes `dev`, once, and asks you nothing.`
- Add a paragraph after it:
  > A finding gets two tries at most: Sonnet first (or a stronger model if
  > the review names one), then Fable, once, given the story of what was
  > tried, what it broke and every example as a test. Damage a fix does
  > counts as the same finding, not a new one. If Fable cannot fix an
  > optional finding, the report lists it under **Fable could not fix
  > this** and the run still pushes. A finding that would undo what the
  > plan chose on purpose, or go past what you asked, is not fixed: the
  > report lists it under **Not chased** for you to decide.
- In the long paragraph, replace `if a finding comes back after a stronger
  model has tried it,` with `if Fable could not fix a must- or should-fix
  finding, if a must-fix finding is the plan's own choice,`.
- "What to do after a review": replace `- **A finding marked recurring** →
  use the stronger model it names.` with `- **A finding marked recurring**
  → `/do-fix <id>` on Fable. It gathers the story itself.` Replace
  `- **"Stop fixing"** → the plan is wrong. New chat, `/do-plan` again.`
  with `- **A must- or should-fix finding closed** ("Fable could not fix
  this") → the plan is wrong. New chat, `/do-plan` again.` Add
  `- **Marked plan's choice or past the request** → yours to decide; no
  fix is suggested.` Replace `Optional: ignore.` with `Optional: your
  choice — the review names who would try them, on the same ladder.`
- "Shortcuts": replace `- **Stuck:** Sonnet failing twice on the same
  thing → switch to Opus.` with `- **Stuck:** a fix that failed once →
  Fable, once, with the story. There is no third try.`
- "Rules that never change": change `which pushes `dev` when its run
  finishes clean.` to `which pushes `dev` when every finding it chases is
  fixed or closed.`

### 6. `docs/plans/README.md`

- Step 4: replace `If a problem comes back after a fix, the next review
  says so and names a stronger model; after two failed attempts it says
  to stop and re-plan.` with `If a problem comes back after a fix, or the
  fix broke something, the next review says so under the same id and
  names Fable for one last try, with the story; if Fable fails, a must- or
  should-fix finding means re-plan.`
- `/do-all` paragraph: replace `until a review finds nothing that must or
  should be fixed.` with `until every finding a review made, optional ones
  included, is fixed or closed; a finding that is the plan's own choice or
  past the request is reported, not fixed.`

### 7. `CLAUDE.md`, "Branches", the second standing exception only

Replace `when its run ends with nothing left that must or should be
fixed,` (wrapped across lines 17–18) with `when its run ends with every
finding it chases — must, should and optional — fixed or closed,`. After
the sentence ending `so the preview is ready to try.` add: `A finding the
review marks as the plan's own choice or past the request is not chased;
the report lists it for the owner.` Change nothing else in `CLAUDE.md`.

### 8. Walk the four cases

Read `do-all.md`, `do-review.md` and `do-fix.md` side by side and trace:
1. A stubborn optional flaw: Sonnet → review says recurring, `next:
   Fable` → Fable with the story → resolved (pushed) or closed ("Fable
   could not fix this", still pushed), with no question to the owner.
2. A finding marked `plan's choice` (optional or should): reported under
   **Not chased**, never sent to `/do-fix`, the run still pushes.
3. A must-fix finding Fable cannot fix: closed, the run stops, nothing
   pushed, the stop account says `/do-plan`.
4. By hand: `/do-review`'s Next step names Sonnet then Fable on the same
   ladder; `/do-fix` on a second attempt gathers the story and refuses
   marked or closed findings.
Fix any wording that lets a case go another way.

## Rules that apply

- `CLAUDE.md` "Branches": work on `dev`, never `main`. `/do-build` commits
  to `dev` and does not push.
- What stays in `/do-all`: never touch `main`, never push a run that
  stopped early, never push before at least one review, one helper at a
  time, five rounds.
- The owner has agreed to `CLAUDE.md`'s `/do-all` sentence being brought
  up to date; only that bullet changes.
- The repository is public: the example lines added to
  `docs/reviews/README.md` name code, never a person.

## Do not

- Do not touch any app code, tests, `package.json`, or
  `docs/reviews/open.md` (it has uncommitted changes of the owner's
  session; leave them unstaged).
- Do not change `do-plan.md`, `do-build.md`, `do-think.md` or
  `do-help.md`, nor how a plan or a build chooses its model (step 1 and
  step 2 of `do-all.md`, the "Who should build and review this" rules).
- Do not change the five-round sentence, the push step, or the existing
  "Never" lines in `do-all.md`.
- Do not push, and do not touch `main`.

## Done when

- `grep -n "Carry on with the optional" .claude/commands/do-all.md docs/FLOW.md`
  finds nothing; `grep -n "asks whether to carry on" docs/FLOW.md` finds
  nothing.
- `grep -n "Sonnet → Opus\|attempted once by Opus\|switch to Opus\|after two failed" .claude/commands docs/FLOW.md docs/reviews/README.md docs/plans/README.md -r`
  finds nothing.
- `grep -n "plan's choice" .claude/commands/do-all.md .claude/commands/do-review.md .claude/commands/do-fix.md docs/reviews/README.md docs/FLOW.md`
  finds at least one line in each, and
  `grep -n "own choice or past the request" CLAUDE.md` finds the new
  sentence.
- `grep -n "Fable could not fix this" .claude/commands/do-all.md .claude/commands/do-review.md .claude/commands/do-fix.md docs/FLOW.md`
  finds a line in each.
- `grep -n "Fix attempt <n> —" .claude/commands/do-all.md .claude/commands/do-fix.md`
  finds a line in each.
- `grep -n "caused by fix" .claude/commands/do-review.md` finds only the
  sentence saying it is never a new finding.
- `grep -n "After five rounds the run stops" .claude/commands/do-all.md`
  still finds the unchanged sentence.
- Step 8's four cases trace as described.
- `npx tsc --noEmit`, `npm test`, `npm run test:tz` and `npm run build`
  pass; `npm run lint` shows the same warning count as before the build
  (run it first and note the count). No app file changed, so these only
  confirm nothing else moved.
- Nothing to look at in the app.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**: text edits to seven files, with the new wording
  given here almost word for word.
- *Review with* **Opus**: this decides when the flow pushes and stops, so
  a contradiction between the three commands matters, but it touches no
  sign-in, data, payments, reminders or database.
- *Effort*: medium.
