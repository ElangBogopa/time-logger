# Friends or family: what the reviews say about time with people

> **BUILT - do not run again.** Built in `dac322b` (2026-11-14). It stays as the record of what was asked.

Closes two findings from review 6 in `docs/reviews/open.md`:
`meetings-read-as-no-people` (must) and `data-label-read-back` (should).

## Goal

The day and week reviews stop saying "no time with people". Time with
people means friends and loved ones — Social, Calls and Faith, exactly what
the Heart ring counts — and work meetings are not part of it. The day review
never says there was none; the week review says "no time with friends or
family" in a plain sentence, and only for a finished week that had none.

## What was found before planning (do not re-investigate)

- Faith **is** a category (`'faith'` in `TimeCategory`, label `'Faith'` in
  `CATEGORY_LABELS`, `src/lib/types.ts`). The category list in `CLAUDE.md`
  is out of date.
- The Heart ring **already counts faith**: `SOCIAL_CATS = ['social',
  'calls', 'faith']` in `src/lib/metrics-calc.ts:139`, used by `calcSocial`.
  No change to the Heart score is needed or allowed.
- The review prompt counts only Social and Calls: `PEOPLE_LABELS` in
  `src/lib/prompts.ts:55`. That is the mismatch.
- Both callers pass per-category labels (`'Social'`, `'Calls'`, `'Faith'`,
  `'Meetings'`…), not the six-bucket ones. Matching on
  `CATEGORY_LABELS[...]` is correct.

## Files

### `src/lib/prompts.ts`

1. **`PEOPLE_LABELS`** — derive it from the Heart ring instead of listing it:
   ```ts
   import { SOCIAL_CATS } from '@/lib/metrics-calc'
   const PEOPLE_LABELS: readonly string[] = SOCIAL_CATS.map((c) => CATEGORY_LABELS[c as TimeCategory])
   ```
   `metrics-calc.ts` imports only from `@/lib/types`, so there is no cycle.
   Keep the function name `peopleMinutes` and its signature; update its
   comment to say it counts what the Heart ring counts (Social, Calls,
   Faith) and that work meetings are left out on purpose.

2. **`REVIEW_VOICE`** — remove the bullet that begins "Say there was no time
   with people only if the data carries the line…". Replace the bullet
   "Say nothing about any other area that is missing from the data." with:
   ```
   - Say nothing about an area that is missing from the data, and never state that something was not logged. The one exception: if the data itself says so in a full sentence, repeat that fact once, flatly, in the data's own words. It is what was logged, not a failing.
   ```
   The voice must not contain the phrases "time with people" or "friends or
   family" — an example sentence in the voice is what the model copied onto
   44 of 48 lines last time.

3. **Delete `peopleLine`.** Replace it with one exported function used only
   by the week:
   ```ts
   /** A sentence, not a label: a label and a colon was pasted back whole. */
   export const NO_FRIENDS_OR_FAMILY = 'No time with friends or family was logged this week.'
   ```

4. **`buildDayReviewPrompt`** — remove `peopleText` and its entry in the
   `logged` array. The day prompt carries nothing about people beyond the
   category rows already listed. Remove the comment above `peopleText`.

5. **`buildWeekReviewContext`** — replace the `peopleLine(...)` line with:
   the `NO_FRIENDS_OR_FAMILY` sentence on its own line (no dash, no label)
   when **all three** hold, and an empty string otherwise:
   - `input.isPartialWeek` is false (a week still in progress is not a
     week with none — principle 9, time-aware labels),
   - `input.categories.length > 0`,
   - `peopleMinutes(input.categories) === 0`.

6. **`buildWeekReviewSystemPrompt`** — no people wording added. It must not
   contain "friends or family" or "time with people". (The voice's general
   exception is what lets the data sentence through.)

7. Add and export the labels the builders write before a colon, so the
   checker can recognise one pasted back:
   ```ts
   export const REVIEW_DATA_LABELS = [
     'Time by category', 'Time tracked', 'Plan', 'Noted', 'Evening mood',
     'Longest focus session', 'Weekly Review Data', 'Days covered',
     'Days with anything logged', 'Best focus days', 'Best focus hours',
     'Hours by category',
   ] as const
   ```
   Do not refactor the builders to use these constants; a test (below)
   keeps the list honest.

8. Update the block comment above `REVIEW_BANNED_WORDS`/`PEOPLE_LABELS` so
   it describes the new behaviour (day silent, finished week states it).

### `src/lib/review-voice-check.ts`

Keep `opts.peopleMinutes`; change its comment to "Minutes of Social, Calls
and Faith in the input, when known." Add `isPartialWeek?: boolean` to
`opts`. Rules about people become:

- Two patterns. `ABSENCE` matches any statement that there was no time
  with people, however worded (people, others, friends, family, loved
  ones, social time, calls). `ABSENCE_OLD_WORDS` matches only the wordings
  that are no longer allowed: "with people", "with others", "social
  time/activity", "calls". Extend today's `NO_PEOPLE` regex to build them;
  the test cases below are the contract, the exact regex is yours.
- `false-absence` — unchanged in meaning: `peopleMinutes > 0` and `ABSENCE`
  matches. Both kinds.
- `day-absence` — new: kind is `'day'`, `false-absence` did not apply, and
  `ABSENCE` matches. A day line never says there was none.
- `absence-wording` — new: kind is `'week'`, `peopleMinutes` is not `> 0`,
  and `ABSENCE_OLD_WORDS` matches.
- `absence-unsaid` — new: kind is `'week'`, `peopleMinutes === 0` exactly
  (not undefined), `isPartialWeek` is not true, and the text does not match
  `/friends (?:or|and) family/i`. `found` is `''`.
- `partial-week-absence` — new: kind is `'week'`, `isPartialWeek === true`,
  `peopleMinutes` is not `> 0`, and `ABSENCE` matches.
- `label-read-back` — new, both kinds: the text contains, case-insensitive,
  any of `REVIEW_DATA_LABELS`, any value of `CATEGORY_LABELS`, or the two
  retired labels `'Time with people'` and `'Time with friends or family'`,
  immediately followed by a colon. Whole-label match (`\b` before it).

### `src/lib/__tests__/review-people-line.test.ts`

Rewrite for the new behaviour:
- `peopleMinutes` counts Social, Calls and Faith and not Meetings:
  Social 120 + Calls 45 + Faith 30 + Meetings 60 → 195.
- `peopleMinutes` agrees with the Heart ring: for every category in
  `SOCIAL_CATS`, `peopleMinutes([{ label: CATEGORY_LABELS[c], minutes: 10 }])`
  is 10; for `'meetings'` it is 0.
- `REVIEW_VOICE`, `buildWeekReviewSystemPrompt()` and any day prompt contain
  neither `/time with people/i` nor `/friends or family/i`.
- A day prompt never carries the sentence or the old label: deep-work-only
  day, meetings-only day, a day with no `hours`.
- Week context: contains `NO_FRIENDS_OR_FAMILY` for a full week of Sleep +
  Meetings only; does not for a week with Faith only, with Calls, with
  `isPartialWeek: true` and none, or with `categories: []`.
- The week context nowhere contains `'Time with people'`.
- Label list is honest: build a day prompt with every optional field set and
  a week context (partial and full); from the lines after the one starting
  `WHAT WAS LOGGED` (day) and from the whole context (week), take each line
  that matches `/^(?:- )?([A-Z][A-Za-z ]*?)(?: so far)?:/` and assert the
  captured label is in `REVIEW_DATA_LABELS` or is a `CATEGORY_LABELS` value.

### `src/lib/__tests__/review-voice-check.test.ts`

- "passes a plain day line": drop the sentence "No time with people was
  logged." from the sample so it still passes.
- Replace the `false-absence` test and add cases (rule names exact):
  - day, `peopleMinutes: 120`, "…No time with people was logged." → `['false-absence']`
  - day, `peopleMinutes: 0`, "Four hours of meetings. No time with friends or family was logged." → `['day-absence']`
  - day, no `peopleMinutes`, "Three hours of deep work. There was no time with people logged." → `['day-absence']`
  - week, `peopleMinutes: 0`, "…You logged no time with friends or family." → `[]`
  - week, `peopleMinutes: 0`, "…No time with people was logged." → `['absence-unsaid', 'absence-wording']`
  - week, `peopleMinutes: 0`, "You logged 20 hours of deep work." → `['absence-unsaid']`
  - week, `peopleMinutes: 0`, `isPartialWeek: true`, "You logged 9 hours of deep work so far." → `[]`
  - week, `peopleMinutes: 0`, `isPartialWeek: true`, "…No time with friends or family so far." → `['partial-week-absence']`
  - week, `peopleMinutes: 45`, "…No social time was logged." → `['false-absence']`
  - day, `peopleMinutes: 120`, "Two hours of social time. No exercise was logged." → `[]`
  - "Meals took 1 hour. Time with people: none logged." (day, `peopleMinutes: 0`) → contains `'label-read-back'`
  - "Time tracked: 5h 30m." and "Deep Work: 4 hours." → contain `'label-read-back'`
  - "The plan held: three blocks kept." → `[]`
- The existing week tests that pass no `peopleMinutes` must stay green
  unchanged (that is why `absence-unsaid` needs an exact `0`).

### `scripts/eval/review-voice.eval.ts`

- Pass `isPartialWeek` to `checkReviewLine` for week scenarios.
- Add the five new rule names (`day-absence`, `absence-wording`,
  `absence-unsaid`, `partial-week-absence`, `label-read-back`) to
  `CHECKER_RULES`.
- Add scenarios:
  - day `faith-day`: Faith 60, Deep Work 180, Meals 60.
  - day `meetings-and-faith`: Meetings 240, Faith 30.
  - week `meetings-week`: Sleep 50, Deep Work 20, Meetings 14, Meals 7.
  - week `faith-week`: Sleep 52, Deep Work 18, Faith 5, Meals 8.
- After the summary table in `report`, add one line: of the full-week lines
  whose input has zero people minutes, how many contain "friends or family".
- Update the header comment's mention of what the checker is given if needed.

### `src/lib/commentary-cache.ts` and `src/app/api/weekly-review/route.ts`

`PROMPT_VERSION` 4 → 5 and `COACH_PROMPT_VERSION` 4 → 5. Nothing else in
either file. Fix any test that pins the old number.

### `CLAUDE.md`

- In "Categories", add `'faith'` (its own FAITH group, "Prayer, worship,
  scripture study, religious community") and correct the count to match
  `TimeCategory` in `src/lib/types.ts`.
- Under "AI API Calls", after the `eval:voice` bullet, add one bullet: the
  reviews count time with friends or family as the Heart ring does
  (`SOCIAL_CATS`: Social, Calls, Faith; work meetings are not); the day
  review never says there was none; a finished week with none is told so in
  a sentence, never a label and a colon.

### `docs/voice-lines/after.md`

Regenerated by the eval run in the steps. Not edited by hand.

## Steps

1. `git branch --show-current` must print `dev`. If not, `git switch dev`.
2. Change `src/lib/prompts.ts` as above.
3. Change `src/lib/review-voice-check.ts`, then both test files. Run
   `npm test -- review-people-line review-voice-check` until green.
4. Raise both version numbers. Run `npx tsc --noEmit` and `npm test`.
5. Update the eval script, then run:
   `EVAL_SAMPLES=3 EVAL_REPORT=docs/voice-lines/after.md npm run eval:voice`
   (needs `OPENAI_API_KEY` in `.env.local`; it calls the live model and
   costs a few cents). If it cannot run, say so plainly in the build report
   and do not claim the "Done when" eval lines.
6. Read `docs/voice-lines/after.md` against the eval targets in "Done when".
   If a target is missed, you may change wording in `REVIEW_VOICE`, the day
   prompt or `NO_FRIENDS_OR_FAMILY`'s surrounding text and run again — **two
   more runs at most**. The fixed points you may not change: the phrase
   "friends or family", no people wording in the voice or system prompt, no
   line in the day prompt, no label-and-colon. If the day line still states
   an absence after the voice change, the allowed next move is one sentence
   in the day prompt's instruction paragraph: "Never state that something
   was not logged." After two more runs, stop and report what is left.
7. Update `CLAUDE.md`.
8. Run the full checks in "Done when", then commit to `dev` (do not push).
   In the build report, paste the saved lines for `plan-missed`,
   `meetings-and-faith`, `faith-day`, `meetings-week` and `faith-week` in
   full, for the owner to read.

## Rules that apply

- **Branches**: work on `dev`; never touch `main`.
- **AI API Calls**: run `npm run eval:voice` after changing what the reviews
  are told; raise `PROMPT_VERSION` and `COACH_PROMPT_VERSION` in the same
  change.
- **Principle 7, one scoring system**: the review counts what `SOCIAL_CATS`
  counts, by importing it. No second list, no new formula.
- **Principle 9, time-aware labels**: nothing is said about a missing kind
  of time while the week is still in progress.
- The checker is used by tests and the eval only. Do not call it from a
  route.

## Do not

- Do not change `SOCIAL_CATS`, `calcSocial`, or anything else in
  `src/lib/metrics-calc.ts`.
- Do not count Meetings as time with people anywhere.
- Do not add a threshold for "very little" time, or any comment on how much
  time with friends or family there was.
- Do not make the day review speak after a run of empty days, and do not
  give the day prompt any knowledge of other days.
- Do not tell faith alone apart from faith with others.
- Do not touch `src/lib/window-alignment.ts` ("Time with people" there is
  Social and Calls in the people windows, a different question) or the
  onboarding copy in `OnboardingModal.tsx`.
- Do not fix the other open findings (`judge-target-missed`,
  `backfill-sends-no-hours`, `week-suggestion-says-consider`,
  `voice-eval-plan-not-marked-built`).
- Do not edit `docs/reviews/open.md`.
- Do not push, and do not merge.

## Done when

- `npx tsc --noEmit` is clean.
- `npm test` passes, with the new tests above in it (1138 passed before).
- `npm run test:tz` passes.
- `npm run lint` stays at 0 errors, 54 warnings.
- `npm run build` succeeds.
- In the regenerated `docs/voice-lines/after.md` (57 lines, 19 scenarios):
  - `day-absence`: 0. No day line says there was no time with friends,
    family or people.
  - `false-absence`: 0. `faith-day`, `meetings-and-faith` and `faith-week`
    lines say nothing about a lack of people.
  - `label-read-back`: 0.
  - `absence-wording`: 0 and `partial-week-absence`: 0.
  - `absence-unsaid`: 0 — every line of `meetings-week`, `focus-only`,
    `leisure-week` and `thin-week` says "friends or family". If the model
    leaves it out on 1 or 2 of those 12 lines after the allowed runs,
    report the count; that is acceptable, a false statement is not.
  - The phrase "time with people" does not appear in any saved line as
    part of a statement that there was none.
  - Other rule counts are no worse than the previous run (1 banned-word,
    19 lines failing a judge rule). They are not this change's to fix.
- Nothing to check on screen: the review screens are unchanged, only the
  generated sentence differs. On a real account the day and week lines are
  regenerated once because of the version change.

## Not decided

Nothing blocks the build. One choice was made here that the owner can
reverse: a week still in progress is told nothing, so the "no time with
friends or family" sentence appears only on a finished week. The owner said
"when the whole week had none"; this reads that literally.

## Who should build and review this

- **Build with Sonnet.** Every file, function, rule name and test case is
  named above; the one open-ended part (re-wording after an eval run) is
  fenced by fixed points and a two-run limit.
- **Review with Opus.** The risk is a sentence that is wrong, which shows in
  the saved lines; nothing here touches sign-in, data, reminders or the
  database.
- **Effort: medium.** The regexes need care, and the test cases pin them.
