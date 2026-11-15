# Review voice: read real lines, then make the prompts stop contradicting themselves

> **BUILT - do not run again.** Built in `fc8affe` (2026-11-14). It stays as the record of what was asked.

## Goal

The day and week review lines are told "do not evaluate the person or the
day" and, a few lines later, "use the scores to judge the day", "70 or more
is a strong day" and "what to watch". Nobody has read what the model writes
under those instructions. Build a test that asks the real model for lines
across different kinds of day and week and checks each line against the
voice rules, save the lines so the owner can read them, then fix the
wording and show with the same test that it got better.

This closes the review finding `voice-prompt-contradicts-itself` in
`docs/reviews/open.md`.

## What is wrong, exactly

- **Day prompt** (`src/app/api/day-commentary/route.ts`, lines 95-110). The
  shared voice says "state what happened, using the numbers and activity
  names from the data", but the prompt carries almost no such data: three
  scores it may not recite, the total time it may not comment on, and
  sometimes one focus session. With nothing to state, the model can only
  turn the scores into a verdict, which the prompt both asks for ("use the
  scores to judge the day", "70 or more is a strong day") and forbids. It
  also always carries the dead line "No targets set."
- **Week prompt** (`src/app/api/weekly-review/route.ts`, lines 417-435).
  Part 2 asks for "What to watch (a pattern or area needing attention)",
  which is an evaluation; part 3 asks for a suggestion while the voice says
  every sentence states what happened; the scores are explained as targets
  met; temperature is 0.7 where the day line uses 0.4.

The fix in both: give the model facts to state, take the scores out of what
it is told, and say plainly which one sentence of the week line is allowed
to be a suggestion.

## Files

- `src/lib/prompts.ts`: add `REVIEW_BANNED_WORDS`, build `REVIEW_VOICE`
  from it, and add `buildDayReviewPrompt`, `buildWeekReviewContext`,
  `buildWeekReviewSystemPrompt`, `DAY_REVIEW_PARAMS`, `WEEK_REVIEW_PARAMS`.
- `src/lib/review-voice-check.ts` (new): `checkReviewLine`, the rules a
  line can be checked against without a model.
- `src/lib/__tests__/review-voice-check.test.ts` (new): the checker against
  fixed example lines.
- `scripts/eval/review-voice.eval.ts` (new): the live test.
- `package.json`: one script, `eval:voice`.
- `src/app/api/day-commentary/route.ts`: use the builder and params; accept
  `hours` in the payload.
- `src/app/api/weekly-review/route.ts`: use the builders and params; raise
  `COACH_PROMPT_VERSION` to 3.
- `src/components/review/DayReviewContent.tsx`: send `hours` in the
  `/api/day-commentary` request body (near line 521). Nothing else.
- `src/lib/commentary-cache.ts`: `PROMPT_VERSION` to 3; the hours join the
  fingerprint.
- Tests to extend: `src/__tests__/api/day-commentary.test.ts`,
  `src/__tests__/api/weekly-review-cache.test.ts`,
  `src/lib/__tests__/commentary-cache.test.ts`.
- `docs/voice-lines/before.md` and `docs/voice-lines/after.md` (new,
  written by the eval, committed).
- `CLAUDE.md`: one bullet under "AI API Calls" (text in step 12).

## Steps

Work in two halves. **Half one changes no wording**: it moves the prompts
to where a test can reach them, builds the test, and records what the
model writes today. **Half two changes the wording** and records again.

### Half one: the test, and the lines as they are now

1. Confirm the branch is `dev` (`git branch --show-current`).

2. **Move the prompts, unchanged**, into `src/lib/prompts.ts` (its header
   comment says why prompts live there: the eval must measure the text
   production sends).
   - `export const DAY_REVIEW_PARAMS = { model: 'gpt-4o-mini', max_tokens: 150, temperature: 0.4 } as const`
   - `export const WEEK_REVIEW_PARAMS = { model: 'gpt-4o-mini', max_tokens: 200, temperature: 0.7 } as const`
   - `export interface DayReviewPromptInput` with the fields the route's
     `DayData` has today, plus (used from step 8)
     `hours?: { label: string; minutes: number }[]`.
   - `export function buildDayReviewPrompt(input: DayReviewPromptInput): string`
     returning exactly the string the route builds today (the `winsText`,
     `targetsText`, `moodText`, `focusText`, `scoresText`, `planText`
     pieces move with it).
   - `export interface WeekReviewContextInput { isPartialWeek: boolean; daysSoFar: number; daysLogged: number; averages: { body: number; mind: number; heart: number }; bestDays: string[]; bestHours: string[]; categories: { label: string; minutes: number }[] }`
   - `export function buildWeekReviewContext(input): string` returning
     exactly the `context` string the route builds today, and
     `export function buildWeekReviewSystemPrompt(): string` returning
     exactly today's system message.
   - Both routes call these and spread the params into
     `openai.chat.completions.create`. `npm test` must pass with no test
     edited: that is the proof the move changed nothing.

3. **One banned-word list.** In `src/lib/prompts.ts` add
   `export const REVIEW_BANNED_WORDS = ['impressive', 'amazing', 'great', 'fantastic', 'incredible', 'solid', 'commitment', 'dedication', 'showcasing', 'crushed', 'nailed', 'well done', 'kudos', 'keep it up', 'proud', 'journey'] as const`
   and make the "Never use these words" line of `REVIEW_VOICE` interpolate
   `REVIEW_BANNED_WORDS.join(', ')`. The resulting string is the same as
   today's.

4. **The checker**, `src/lib/review-voice-check.ts`. Pure, no imports
   beyond `REVIEW_BANNED_WORDS`. It is used by tests and the eval only;
   say so in its header comment.

   ```ts
   export interface VoiceBreach { rule: string; found: string }
   export function checkReviewLine(
     text: string,
     opts: { kind: 'day' | 'week'; mood?: 'low' | 'okay' | 'great' | null }
   ): VoiceBreach[]
   ```

   Rules, all case-insensitive, words matched whole (`\b`), `found` is the
   matched text:

   | rule | applies | breach when the line contains |
   |---|---|---|
   | `banned-word` | both | any entry of `REVIEW_BANNED_WORDS` |
   | `verdict` | both | strong, productive, unproductive, successful, excellent, well-rounded, balanced, struggled, neglected, lacking, fell short, room for improvement |
   | `exclamation` | both | `!` |
   | `question` | both | `?` |
   | `emoji` | both | `/\p{Extended_Pictographic}/u` |
   | `score-talk` | both | `/100`, `out of 100`, `score`, `scores`, `scored` |
   | `relative-day` | day | today, yesterday, tomorrow |
   | `advice` | day | should, try, consider, aim, next time, need to |
   | `correction` | week | should, need to, must |
   | `hard-day` | day, unless `mood === 'low'` | tough, challenging, difficult, rough |
   | `too-long` | both | more than 3 sentences (day) or 4 (week); count matches of `/[.!?](?=\s+\S|\s*$)/g` |
   | `list` | both | a line starting with `-`, `•` or a digit followed by `.` |
   | `empty` | both | nothing after trimming |

   The verdict words live in an exported `REVIEW_VERDICT_WORDS` in this
   file.

5. **Checker tests**, `src/lib/__tests__/review-voice-check.test.ts`. One
   `it` per row, each a fixed example of something a model plausibly
   returns, asserting the rule ids found:
   - `'Four hours of deep work, most of it in one block on the essay. A 30-minute walk. No time with people was logged.'` (day) → no breaches.
   - `'A steady day with real focus in it. Great work!'` (day) → `banned-word`, `exclamation`.
   - `'The day was a strong one for focus, with Mind at 82/100.'` → `verdict`, `score-talk`.
   - `'Today held three hours of meetings.'` → `relative-day`.
   - `'Two hours of TV. Consider a walk next time.'` → `advice`.
   - `'It was a tough day with little logged.'` → `hard-day` with no mood; no `hard-day` with `mood: 'low'`.
   - `'How did the afternoon go? Three hours of admin.'` → `question`.
   - a four-sentence day line → `too-long`; the same four sentences as a week line → not `too-long`.
   - `'- Deep work: 3h\n- Sleep: 8h'` → `list`.
   - `''` → `empty`.
   - `'Greater Manchester run, 40 minutes.'` → no `banned-word` (whole words only).
   - week: `'You logged 12 hours of deep work, most of it before noon. One option for next week is a walk on Wednesday at 3 PM.'` → no breaches.
   - week: `'You should protect your mornings.'` → `correction`.
   - every entry of `REVIEW_BANNED_WORDS` and `REVIEW_VERDICT_WORDS`, placed in a sentence by a loop, is caught.

6. **The live test**, `scripts/eval/review-voice.eval.ts`. Follow
   `scripts/eval/replies.eval.ts` for everything structural: the
   `@jest-environment node` header, `loadEnv()` reading `.env.local`, the
   worker pool, the judge call with `response_format: { type: 'json_object' }`
   at temperature 0, printing through `process.stdout.write`.
   - Lines are generated with `buildDayReviewPrompt` + `DAY_REVIEW_PARAMS`
     (one user message) and `buildWeekReviewSystemPrompt` +
     `buildWeekReviewContext` + `WEEK_REVIEW_PARAMS` (system + user), the
     same shapes the routes send.
   - Each scenario is generated `Number(process.env.EVAL_SAMPLES || 3)`
     times, because one sample at a non-zero temperature proves little.
   - **Day scenarios** (minutes by category label; build the full input
     object for each, with `totalMinutesLogged` the sum, plausible
     `metrics` between 0 and 99, and `hours` filled in from the same
     numbers so the scenario works before and after step 8):

     | id | hours | other input | what it tempts |
     |---|---|---|---|
     | `focus-heavy` | Deep Work 240, Meals 60, Sleep 450 | focus session 150 on "Essay draft", win `2h 30m focus session on "Essay draft"`, plan 3 kept | praise |
     | `full-day` | Deep Work 180, Exercise 60, Social 120, Meals 90, Sleep 480 | mood great, metrics all 80+ | praise |
     | `thin` | Shallow Work 45 | nothing else | filling the gap |
     | `leisure` | Entertainment 300, Meals 60, Sleep 540 | metrics low | criticism, advice |
     | `low-mood` | Deep Work 60, Entertainment 240 | mood low | consolation |
     | `plan-missed` | Meetings 240, Admin 90 | plan 0 kept, 1 moved, 3 missed | criticism |
     | `body-day` | Exercise 120, Chores 120, Calls 45 | no focus session | praise |
     | `work-only` | Deep Work 360, Shallow Work 120, Meals 30 | focus session 200 on "Quarterly model" | "no people" as a failing |
     | `sleep-only` | Sleep 480 | nothing else | inventing a day |
     | `even` | Learning 150, Movement 30, Social 60, Rest 60 | mood okay | "balanced" |

   - **Week scenarios** (hours by category label for `categories`; pick
     plausible averages, `bestDays`, `bestHours`):

     | id | shape |
     |---|---|
     | `full-week` | all 7 days, Sleep 52h, Deep Work 22h, Meetings 8h, Exercise 4h, Social 6h, Meals 9h, Entertainment 7h |
     | `focus-only` | all 7, Deep Work 38h, Shallow Work 10h, Sleep 44h, Meals 5h, nothing social, no exercise |
     | `partial` | 3 of 7 days, in progress, Deep Work 9h, Sleep 22h, Exercise 1h |
     | `leisure-week` | all 7, Entertainment 30h, Sleep 60h, Meals 10h, Shallow Work 6h |
     | `thin-week` | all 7 covered, 2 days with anything logged, Deep Work 3h, Meals 1h |
     | `sleep-heavy` | all 7, Sleep 63h, Rest 10h, Calls 3h, Chores 6h |

   - Every line goes through `checkReviewLine`, then to the judge, which
     is given the exact input the model had and the line, and grades:
     - both: `no_evaluation` — the line does not say or imply the day,
       the week or the person was good, bad, strong, weak, enough or not
       enough (for a week line, ignoring its one suggestion sentence).
     - both: `grounded` — every number, activity and category in the line
       appears in the input; nothing is invented.
     - both: `no_consolation` — no reassurance, sympathy or encouragement.
     - day: `no_advice` — nothing is suggested or recommended.
     - week: `one_suggestion` — at most one sentence suggests something,
       and it names a specific day, hour or activity.
     - week: `total_not_judged` — the total hours logged are not praised
       or criticised, and sleep being the largest category is not
       presented as a finding.
     plus `"note"`: one short sentence on the worst problem, or `fine`.
   - Print: per rule, how many lines breached it (checker rules and judge
     rules listed separately); then **every line**, grouped by scenario,
     each followed by its breaches and the judge's note. All lines, not
     only failures: the point is that they get read.
   - When `process.env.EVAL_REPORT` is set, write the same content to that
     path as Markdown (a heading per scenario, the input as a short list,
     each line as a blockquote, breaches under it, and the totals table
     at the top with the date and the two params objects).
   - The `it` asserts only that every line is non-empty. The numbers are a
     report, as in the other evals.
   - `package.json`: `"eval:voice": "jest --testMatch='**/scripts/eval/review-voice.eval.ts' --testTimeout=1800000 --runInBand"`.
     Do not run `npm run eval`: it also runs the 1000-case categoriser.

7. **Record today's lines.** Run
   `EVAL_REPORT=docs/voice-lines/before.md npm run eval:voice`.
   It makes about 100 small `gpt-4o-mini` calls. **If it cannot run** (no
   `.env.local`, no key, the API refuses), stop here: commit half one,
   do not change any wording, and say in the build report that the lines
   are still unread. The finding itself says the wording waits for them.

### Half two: the wording

8. **Day prompt.** `buildDayReviewPrompt` now returns (pieces that are
   empty leave no blank bullet; `hoursText` is one `- ${label}: ${formatDurationLong(minutes)}`
   line per entry of `input.hours` with minutes > 0, largest first, or
   `Nothing was broken down by category.` when there are none):

   ```
   You are reviewing someone's day from their time log. Write 2 sentences, 3 at most. Name what actually happened. Never describe the day as hard, tough or challenging unless their mood says so.

   ${REVIEW_VOICE}

   This may be read on the day itself or days later, so never write "today", "yesterday" or "tomorrow": say "the day". You know nothing about any other day, so make no comparisons such as "lower than usual". Give no advice and suggest nothing. The person's scores are on screen above your words: do not mention scores or targets, and do not sum the day up with a verdict.

   WHAT WAS LOGGED. Write only from this:
   Time by category:
   ${hoursText}
   Time tracked: ${hours}h ${minutes}m (this only says how much was written down — do not praise or criticise it)
   ${planText}
   ${winsText}
   ${moodText}
   ${focusText}

   Write the 2-3 sentences now:
   ```

   Gone on purpose: the scores themselves, the paragraph explaining 80 and
   70, "Use the scores to judge the day", `targetsText` ("No targets
   set."), and "You may note, lightly and once, an area that got no time"
   (the voice already says how an empty area is stated). `metrics` and
   `targetProgress` stay in the input type, unused, with a comment saying
   they are accepted and not put in the prompt, and why. Keep the code
   comment about the old "Day Score" and add one sentence on this change.

9. **Send the hours.**
   - `src/app/api/day-commentary/route.ts`: `DayData` gains
     `hours?: { label: string; minutes: number }[]`; pass it through,
     defaulting to `[]`. Ignore entries whose `label` is not a string or
     whose `minutes` is not a finite number above 0, cap the list at 19
     entries and each label at 40 characters (it is request input going
     into a prompt).
   - `src/components/review/DayReviewContent.tsx`, in the request body of
     `generateCommentary`: add
     `hours: (summaryData.categoryBreakdown ?? []).map((c) => ({ label: c.label, minutes: c.minutes })),`
   - `src/lib/commentary-cache.ts`: `PROMPT_VERSION = 3`;
     `CommentaryInputs` gains
     `categoryBreakdown?: { category: string; minutes: number }[]` and the
     hashed array gains
     `(inputs.categoryBreakdown ?? []).map((c) => [c.category, c.minutes])`.
     The caller already spreads the whole summary in, so it needs no edit.

10. **Week prompt.**
    - `buildWeekReviewContext` drops the three `Average …/100` lines (and
      `averages` from its input type). Everything else in the context
      stays.
    - `buildWeekReviewSystemPrompt` returns:

      ```
      You are writing a brief weekly reflection from someone's time log (3-4 sentences max).

      Write it in this order:
      1. What the week held: two or three specific things from the data, with their hours.
      2. One pattern in the data, stated as a fact, such as the days or hours where the focused work fell. Leave this out if the data shows none.
      3. One option for next week, in a single plain sentence that starts from a fact in the data and names a day, an hour or an activity. This is the only sentence that is not a statement of what happened. It is an option, not a correction: no "should", no "need to", no "must".

      Use "you" language. Reference specific data from their week.

      ${REVIEW_VOICE}

      Don't use bullet points - write in flowing prose.
      Keep it concise - no more than 4 sentences total.
      The person's scores are on screen above your words: do not mention scores or targets, and do not sum the week up with a verdict.
      The hours logged only say how much of the week was written down. Never praise or criticise the total, and never treat logging fewer hours as an achievement.
      Sleep is the largest category for anyone who logs it; do not present that as a finding.
      If the week is still in progress, say "so far" and do not compare it with a full week.
      ```
    - `WEEK_REVIEW_PARAMS.temperature` becomes `0.4`.
    - `COACH_PROMPT_VERSION = 3` in `src/app/api/weekly-review/route.ts`.

11. **Record the new lines and compare.** Run
    `EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice`.
    The target, over all lines of the run:
    - no checker breaches at all, and
    - no more than 3 lines failing any judge rule (the judge is itself a
      model and is sometimes wrong; read its note before believing it).

    If the target is missed, up to **two** more rounds are allowed, each:
    add at most one sentence to the day or week prompt, or words to
    `REVIEW_BANNED_WORDS`, aimed at a pattern that appears in at least two
    lines; re-run; overwrite `after.md`. Not allowed in any round:
    loosening `checkReviewLine`, removing a scenario or a judge rule,
    deleting a rule from `REVIEW_VOICE`, or raising the limits above. After
    two rounds, stop whatever the numbers are and report them as they are.
    If a checker rule is plainly wrong about a line (a false alarm), leave
    the rule, and name the line in the build report.

12. **Tests and notes.**
    - `src/__tests__/api/day-commentary.test.ts`: add `hours` to a payload
      and assert the prompt contains `Deep Work: ` with its duration;
      assert the prompt contains none of `judge the day`, `strong day`,
      `/100`, `No targets set`; assert a payload with a malformed `hours`
      (a string, an entry with negative minutes) still answers 200 and
      leaves the bad entry out of the prompt. The existing tests stay.
    - `src/__tests__/api/weekly-review-cache.test.ts`: assert the system
      prompt contains `only sentence that is not a statement` and none of
      `What to watch`, `needing attention`; that the user message contains
      no `/100`; that the call's `temperature` is `0.4`.
    - `src/lib/__tests__/commentary-cache.test.ts`: the fingerprint
      changes when a category's minutes change with the total held equal,
      and does not change when nothing does.
    - The doc comment above `REVIEW_VOICE` in `src/lib/prompts.ts`: add
      that `npm run eval:voice` is how a wording change is checked.
    - `CLAUDE.md`, under "AI API Calls", one bullet:
      `**DO**: Run \`npm run eval:voice\` after changing what the day or week review is told (\`REVIEW_VOICE\` and the builders beside it in \`lib/prompts.ts\`). It asks the real model for lines and checks each against the voice; the last run is in \`docs/voice-lines/after.md\`. Raise \`PROMPT_VERSION\` and \`COACH_PROMPT_VERSION\` in the same change.`

13. Run the checks under "Done when". Commit to `dev`, staging only the
    files this brief names. `docs/reviews/open.md` has an uncommitted
    review entry: do not edit it and do not stage it.

## Rules that apply

- Branches: `dev` only, no push, nothing near `main`.
- "AI API Calls": the routes keep checking the session and rate-limiting
  before any model call; this change must not add a model call to either
  route. The eval is the only new caller and it is not part of `npm test`.
- Design principle 7, one scoring system: the review line must not become
  a second verdict beside the three rings. That is the reason the scores
  leave the prompt.
- Design principle 9, time-aware labels: no line may call a day hard or
  short of something. The `hard-day` and `verdict` rules check it.
- The header of `src/lib/prompts.ts`: an eval measures the text production
  sends, never a copy.
- `OPENAI_API_KEY` stays server-only. The eval reads it from `.env.local`
  on the machine; never print it, never write it to a report.

## Do not

- Do not change `REVIEW_VOICE`'s rules, except through
  `REVIEW_BANNED_WORDS` as step 11 allows.
- Do not add a runtime check, retry or filter of the model's line in
  either route. The checker is for tests and the eval.
- Do not touch `src/app/api/day-review/backfill/route.ts`, the
  `day_reviews` table, or lines already saved there. Finalised days keep
  the line they were saved with.
- Do not change how the weekly numbers are computed, the weekly cache
  handshake (`knownCoachFingerprint`), or anything in
  `WeeklyReviewContent.tsx`.
- Do not touch `/api/commentary`, `/api/commentary/thread`, the categoriser
  prompt, or the two existing eval files.
- Do not change the model (`gpt-4o-mini`) or `max_tokens`.
- Do not edit `docs/reviews/open.md` or mark the finding resolved; the
  next `/do-review` does that.
- Do not put anything from a real account in a scenario or a report. The
  scenarios are invented.

## Done when

- `npx tsc --noEmit` is clean.
- `npm test` passes, including the new checker tests and the added
  assertions. After step 2 alone it passes with no test edited.
- `npm run test:tz` passes.
- `npm run lint`: 0 errors, 54 warnings (today's count).
- `npm run build` succeeds.
- `docs/voice-lines/before.md` and `docs/voice-lines/after.md` exist, each
  with every generated line and the totals table.
- `after.md` meets the target of step 11, or the build report states the
  final numbers and quotes each line still breaching.
- `grep -rn "judge the day\|strong day\|What to watch" src` finds nothing
  outside tests.
- The build report gives the before and after totals side by side per
  rule, and quotes three before/after pairs for the same scenario.
- In the app (`npm run dev`, signed in): open Review on a day with
  entries. A line appears under the rings, names hours and activities from
  that day, and carries no score and no verdict. Open the weekly review:
  the summary ends with one concrete option for next week. Both appear
  once and are not regenerated on returning to the tab (the version bump
  must cost one new call per day or week, not one per view).

## Not decided

- **Whether the week line keeps its one suggestion.** This brief keeps it,
  as the earlier voice plan did, and rewords it as an option. If the owner
  reads `after.md` and wants no suggestion at all, it is a one-paragraph
  change to `buildWeekReviewSystemPrompt` plus removing `one_suggestion`
  from the judge.
- **Whether lines should also be checked when they are generated for a
  real person** (drop or regenerate a line that breaks a checker rule).
  Left out: it adds a second model call on some views. Worth deciding
  after reading `after.md`.
- The owner reading `docs/voice-lines/after.md` is the step no model can
  do. The finding is closed by that reading, not by the numbers.

## Who should build and review this

- **Build with Sonnet.** The prompts, the rules, the scenarios and the
  limits on adjusting them are written out here; the two allowed rounds of
  wording are bounded and measured.
- **Review with Opus.** Nothing here touches sign-in, stored data or
  reminders, and the result can be read in `after.md`; the reviewer's job
  is to check the move in step 2 changed nothing, the hours from the
  request are sanitised, and the checker was not loosened to pass.
- **Effort: medium.**
