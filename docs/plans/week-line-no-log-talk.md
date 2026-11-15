# The week line stops talking about how much was logged

> **BUILT - do not run again.** Built on 2026-11-15 in the commit titled "fix: the week line is no longer sent day counts or told to talk about logging". It stays as the record of what was asked.

Closes the open finding `judge-target-missed` (last recorded in
`docs/reviews/merged-2026-11-15.md`).

## Goal

The weekly review line says what the logged time held, and never comments
on how many days or hours were written down, how complete the log is, or
what that suggests. The fix removes what makes the model say it, instead of
adding one more "do not" sentence on top. Nothing that is stored changes.
The day line, the scores and the screens are not touched.

## What was found before planning (do not re-investigate)

The last run (`docs/voice-lines/after.md`, 60 lines) has 19 lines failing
the judge rule `total_not_judged`, all of them week lines. Reading them:

- **The model is handed a count of days logged, and repeats it.** The
  context from `buildWeekReviewContext` (`src/lib/prompts.ts`) contains
  `- Days covered: all 7` and `- Days with anything logged: 7`. Failing
  lines: "You logged all seven days, with no hours unaccounted for", "You
  logged time on all seven days", and for the week in progress "This week
  held three days of logging".
- **The system prompt itself talks about logging.** `buildWeekReviewSystemPrompt`
  says "The hours logged only say how much of the week was written down.
  Never praise or criticise the total, and never treat logging fewer hours
  as an achievement." and "Sleep is the largest category for anyone who logs
  it". The lines then use "logged" everywhere: "The best focus hours were
  logged at 9 AM and 10 AM" (this alone is marked failing on several lines,
  e.g. every faith-week and meetings-week line), "You logged 5 hours for
  faith".
- **The suggestion sentence is turned into "log more".** "You might consider
  logging more focused work next week", "consider logging additional
  activities on Tuesday", "consider logging some time with friends".
- **"Not enough data" is a remark about the log.** With no best focus days
  the context says `Best focus days: Not enough data`, and the line says
  "There is not enough data to determine your best focus days or hours".
- **Sleep leads.** The context lists categories in whatever order it is
  given; in the eval Sleep is often first, and the sleep-heavy and
  leisure-week lines open with "You logged 63 hours of sleep" / "60 hours of
  sleep". The rule also forbids sleep as a finding.
- The judge (`JUDGE_WEEK` in `scripts/eval/review-voice.eval.ts`) is noisy:
  its notes are boilerplate ("The total hours logged are judged"), and the
  thin-week lines that say "Only two days had any time logged" passed it.
  It appears to react to the word "logged". That is a reason to take the
  word out of what the model reads; it is **not** licence to change the
  judge (see Do not).

`checkReviewLine` (`src/lib/review-voice-check.ts`) is used only by the
eval and tests, not by a route.

## Files

### `src/lib/prompts.ts`

1. **`WeekReviewContextInput`**: remove the fields `daysLogged` and
   `daysSoFar`. Keep `isPartialWeek`, `bestDays`, `bestHours`, `categories`.
2. **`buildWeekReviewContext`** becomes, in substance:
   ```ts
   export function buildWeekReviewContext(input: WeekReviewContextInput): string {
     const hoursOf = (minutes: number) => Math.round((minutes / 60) * 10) / 10
     const noneThisWeek =
       !input.isPartialWeek && input.categories.length > 0 && peopleMinutes(input.categories) === 0
     // Sleep last: it is the largest category for anyone who logs it, and a
     // line that opens with it presents it as the week's finding.
     const sleep = CATEGORY_LABELS.sleep
     const ordered = [...input.categories].sort(
       (a, b) => Number(a.label === sleep) - Number(b.label === sleep) || b.minutes - a.minutes
     )
     const lines = [
       'Weekly Review Data:',
       input.isPartialWeek ? 'The week is still in progress.' : '',
       input.bestDays.length > 0 ? `- Best focus days: ${input.bestDays.join(', ')}` : '',
       input.bestHours.length > 0 ? `- Best focus hours: ${input.bestHours.join(', ')}` : '',
       '',
       `Hours by category${input.isPartialWeek ? ' so far' : ''}:`,
       ...ordered.map((c) => `- ${c.label}: ${hoursOf(c.minutes)}h`),
       noneThisWeek ? `\n${NO_FRIENDS_OR_FAMILY}` : '',
     ]
     return `\n${lines.filter((l, i) => l !== '' || i === 4).join('\n')}\n\n`
   }
   ```
   The exact string assembly is the builder's; what matters: no count of
   days logged, no "Days covered" line and no day count of any kind; a week
   in progress gets the one sentence `The week is still in progress.` and
   the `so far` on the hours heading; empty best days or hours leave their
   line out (no `Not enough data`); Sleep is listed last, the rest by hours
   descending; the `NO_FRIENDS_OR_FAMILY` sentence stays exactly as it is,
   on its own line, under the same condition. Keep the comment explaining
   `noneThisWeek`. Add a one-line comment above the function saying why
   the day counts are not sent (the model turned them into remarks about
   how much was logged).
3. **`buildWeekReviewSystemPrompt`**: replace the two sentences
   "The hours logged only say how much of the week was written down. Never
   praise or criticise the total, and never treat logging fewer hours as an
   achievement." and "Sleep is the largest category for anyone who logs it;
   do not present that as a finding." with one passage that says what to
   write instead, and does not itself use "logged", "logging" or "logs".
   Starting wording (the builder may adjust it between eval runs, within
   the Do not list):
   > Write about what the time went to, never about the record of it. Say
   > "you spent" or name the activity and its hours. Say nothing about how
   > many days or hours the data covers, and do not suggest writing more
   > down. Sleep is listed last and is not a finding.

   And in point 3 of the ordered list, after "names a day, an hour or an
   activity.", add: "It is about something to do, not about something to
   record." Keep everything else in the system prompt as it is, including
   the "so far" sentence, the "best focus" sentence and the scores
   sentence. The prompt must still not contain "friends or family" or
   "time with people" (`review-people-line.test.ts` checks it).
4. **`REVIEW_DATA_LABELS`**: leave `'Days covered'` and
   `'Days with anything logged'` in the list. The checker uses it to catch
   a label read back, and old wording is still worth catching.
5. **Do not change `REVIEW_VOICE`** or anything the day line uses.

### `src/app/api/weekly-review/route.ts`

- In the `buildWeekReviewContext({...})` call (around line 396) remove
  `daysSoFar,` and `daysLogged: dayScores.length,`. `daysSoFar` is still
  used elsewhere in the route; leave those uses alone.
- `COACH_PROMPT_VERSION` 5 → 6.

### `src/lib/commentary-cache.ts`

- Not changed. `PROMPT_VERSION` stays 5, because `REVIEW_VOICE` and the
  day prompt do not change.

### `scripts/eval/review-voice.eval.ts`

- `week()` helper: drop `daysSoFar: 7` and `daysLogged: 7` from the
  defaults. Scenario `partial`: drop `daysSoFar: 3` and `daysLogged: 3`
  (keep `isPartialWeek: true`). Scenario `thin-week`: drop `daysLogged: 2`.
  Hours, best days and best hours of every scenario stay exactly as they
  are.
- `describeInput` for a week: replace the "days covered … days with
  anything logged" line with `week: ${i.isPartialWeek ? 'in progress' : 'finished'}`.
- Nothing else in the file changes: not `JUDGE_BOTH`, `JUDGE_DAY`,
  `JUDGE_WEEK`, the judge prompt, the model, `SAMPLES`, the day scenarios
  or the report format.

### `src/lib/__tests__/review-people-line.test.ts`

- `week()` helper: drop `daysSoFar` and `daysLogged`; calls passing
  `daysSoFar: 3` drop it (keep `isPartialWeek: true`).
- Line 136: the expected week labels become
  `['Weekly Review Data', 'Best focus days', 'Best focus hours', 'Hours by category', 'Sleep']`.

### `src/lib/__tests__/review-week-context.test.ts` (new)

Tests of `buildWeekReviewContext` and `buildWeekReviewSystemPrompt`:
- A finished week and a week in progress: neither context contains
  `Days with anything logged`, `Days covered`, `of 7`, or a day count
  (`/\b\d+ (?:of 7|days?)\b/`).
- A week in progress contains `The week is still in progress.` and
  `Hours by category so far:`; a finished week contains neither.
- Empty `bestDays` and `bestHours`: no `Best focus days`, no
  `Best focus hours`, no `Not enough data`. Non-empty: both lines present.
- Categories given as Sleep 50h, Meetings 8h, Deep Work 20h come out in the
  order Deep Work, Meetings, Sleep.
- The system prompt does not match `/\blog(?:ged|ging|s)\b/i` and contains
  `so far`.

### `docs/voice-lines/after.md`

- Replaced by the best eval run (see Steps). `docs/voice-lines/before.md`
  is not touched.

## Steps

1. Check you are on `dev` (`git branch --show-current`).
2. Change `src/lib/prompts.ts` as above. Update the route call and
   `COACH_PROMPT_VERSION`.
3. Update `scripts/eval/review-voice.eval.ts` and
   `review-people-line.test.ts`; add `review-week-context.test.ts`.
4. Run `npx tsc --noEmit`, `npm test`, `npm run lint` (54 warnings, 0
   errors today; must not rise) before spending a model run.
5. **Eval, at most three runs in total.** Write each run to its own file so
   the best can be kept:
   `EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/run-1.md npm run eval:voice`
   (then `run-2.md`, `run-3.md`). It needs `OPENAI_API_KEY` in `.env.local`.
   The baseline to compare against is the current `after.md`:

   | rule | baseline |
   |---|---|
   | banned-word | 1 |
   | absence-unsaid | 2 |
   | too-long | 2 |
   | no_consolation | 2 |
   | total_not_judged | 19 |
   | every other checker and judge rule | 0 |

   After each run, read every week line and the table. Stop as soon as a
   run has `total_not_judged` at 3 or fewer and no rule above its baseline.
   Otherwise read the failing week lines, find what in the week context or
   week system prompt they echo, change only that wording (step 2's files,
   week prompt only), rerun `npm test`, and run again.
6. Keep the best run: the lowest `total_not_judged` among runs with no rule
   above baseline; if no run has every rule at or below baseline, the
   lowest `total_not_judged`, and say which rule is worse. Copy it to
   `docs/voice-lines/after.md` and delete the `run-*.md` files. If the kept
   run is not the last one, put the prompt wording back to what produced
   it, and rerun `npm test`.
7. Run `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.
8. Commit to `dev`. The commit message states the kept run's
   `total_not_judged` count, any rule that is worse than baseline, and how
   many runs were used. If the count is above 3, it says so plainly, quotes
   what the remaining failing lines say, and does not claim the target was
   met.

## Rules that apply

- CLAUDE.md, AI API Calls: run `npm run eval:voice` after changing what the
  week review is told; the last run lives in `docs/voice-lines/after.md`;
  raise the prompt version in the same change. The request settles that
  only `COACH_PROMPT_VERSION` is raised, since `REVIEW_VOICE` and the day
  prompt do not change; if the builder ends up changing `REVIEW_VOICE`
  after all, raise `PROMPT_VERSION` in `src/lib/commentary-cache.ts` too.
- CLAUDE.md, AI API Calls: a finished week with no time with friends or
  family is told so in the `NO_FRIENDS_OR_FAMILY` sentence, never a label
  and a colon; a week in progress is told nothing. Unchanged here, and the
  tests keep it.
- `src/lib/prompts.ts` header: the eval measures the text production sends,
  so the eval must import the builders, never copy them.
- Branches: work on `dev`; never commit to or push `main`.

## Do not

- Do not change what is stored, the day line (`buildDayReviewPrompt`),
  `REVIEW_VOICE`, the scores, or any screen.
- Do not remove Sleep or any other category from what is sent to the
  model; only its order changes. Sending less than the request settled
  (the day counts) is a choice about a person's data that is not made here.
- Do not change the eval's judge rules, judge prompt, judge model,
  scenarios' hours, samples or report format. The count has to be
  comparable with the run it replaces.
- Do not add a checker rule to `review-voice-check.ts`.
- Do not add new "never say X" sentences to work around a remaining
  failure when a phrase in the data or prompt it echoes can be taken out.
- Do not run the eval more than three times.
- Do not push. The run that this brief is part of pushes `dev` after its
  review (`/do-all`); a standalone build leaves pushing to the owner.

## Done when

- `npx tsc --noEmit` clean; `npm test` passes, including the new
  `review-week-context.test.ts`; `npm run lint` at 0 errors and no more
  than 54 warnings; `npm run build` passes.
- `docs/voice-lines/after.md` is a run made after this change, with
  `total_not_judged` at 3 or fewer and no checker or judge rule above the
  baseline table in step 5. If that was not reached in three runs, the
  commit says the number reached and what the remaining lines say.
- `COACH_PROMPT_VERSION` is 6; `PROMPT_VERSION` is still 5 unless
  `REVIEW_VOICE` changed.
- In the app (dev preview, after the push): the Review tab's weekly line
  says what the week's time went to and does not mention how many days or
  hours were logged.

## Not decided

nothing

## Who should build and review this

- **Build with Sonnet.** Every file, function, field and test is named,
  with the code shape given; the one open-ended part (rewording between
  eval runs) is fenced by fixed points, a three-run limit and a rule for
  which run to keep.
- **Review with Opus.** The risk is a line that reads wrong or a judge
  count that was gamed, which shows in the saved lines and the eval diff;
  nothing here touches sign-in, data, reminders or the database.
- **Effort: medium.**
