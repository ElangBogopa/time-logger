# Brand voice fixes: review commentary, the first library source, averages

> **BUILT - do not run again.** Built in `cfa9b5e` (2026-11-14). It stays as the record of what was asked.

## Goal

Three places in the app break the brand's own rules (plain voice, no hype,
never overclaim the science). Fix them before anyone outside friends sees
the app: the review's AI line and "Wins" block praise instead of stating
facts, the first source in The Science credits a book with a finding it
does not contain, and a few lines state averages as personal fact.

## Files

- `src/lib/prompts.ts`: add an exported `REVIEW_VOICE` string (text below).
- `src/app/api/day-commentary/route.ts`: rewrite the prompt's voice lines
  to use `REVIEW_VOICE`; temperature 0.7 → 0.4.
- `src/app/api/weekly-review/route.ts`: replace the "supportive coach /
  warm" lines of the system prompt with `REVIEW_VOICE`; add a prompt
  version to the coach fingerprint.
- `src/lib/commentary-cache.ts`: add a prompt version to
  `commentaryFingerprint` so lines written by the old prompt are not reused.
- `src/app/api/day-summary/route.ts`: reword one win text in `generateWins`.
- `src/components/review/DayReviewContent.tsx`: `WinsSection` loses the
  trophy, the green rows and the coloured icons; new heading.
- `src/components/review/WeeklyReviewContent.tsx`: remove the `Trophy` icon
  from the highlight cards.
- `src/lib/library.ts`: replace the `time-paradox` entry with a verified
  study.
- `src/lib/ideal-day.ts`: one `reason` string.
- `src/components/DayWindowsCard.tsx`: one `DialogDescription` string.
- `src/app/settings/page.tsx` and `src/app/guide/page.tsx`: the
  "Science-backed" subtitle, and three paragraphs on the guide page.
- Tests: `src/__tests__/api/day-commentary.test.ts`,
  `src/__tests__/library.test.ts`, `src/__tests__/suggest-times.test.ts`,
  and the four tests that wait for the text "Today's Wins"
  (`day-review.test.tsx`, `day-review-commentary-loop.test.tsx`,
  `day-review-embedded-chrome.test.tsx`, `review-window-alignment.test.tsx`).

## Steps

1. Confirm the branch is `dev` (`git branch --show-current`).

2. **`REVIEW_VOICE`** in `src/lib/prompts.ts`, exported, exactly:

   ```
   VOICE: plain, calm, specific. Short sentences that state what happened, using the numbers and activity names from the data.
   - State facts. Do not evaluate the person or the day. No praise, no encouragement, no consolation.
   - Never use these words or anything like them: impressive, amazing, great, fantastic, incredible, solid, commitment, dedication, showcasing, crushed, nailed, well done, kudos, keep it up, proud, journey.
   - No exclamation marks, no emoji, no questions.
   - An area that got no time is stated once, flatly, as what was logged: "No time with people was logged." It is not a failing.
   Example of the register: "Four hours of focused work, most of it in one block on the essay. A 30-minute walk. No time with people was logged."
   ```

3. **Day prompt** (`day-commentary/route.ts`). In the `prompt` template:
   - First line becomes: `You are reviewing someone's day from their time
     log. Write 2 sentences, 3 at most. Name what actually happened. Never
     describe the day as hard, tough or challenging unless their mood says
     so.` followed by a blank line and `${REVIEW_VOICE}`.
   - Last line becomes: `Write the 2-3 sentences now:`
   - Remove the words "warm", "a little dry" and "warm and specific"
     wherever they appear. Keep every other rule in the prompt as it is
     (do not recite the scores, never "today/yesterday/tomorrow", no
     comparisons, no advice, hours tracked are not praised).
   - Change `Wins today:` to `Noted:` and `No specific wins detected.` to
     an empty string.
   - `temperature: 0.4`.

4. **Weekly prompt** (`weekly-review/route.ts`, the system message near
   line 415). Replace `You are a supportive personal time coach. Write a
   brief weekly reflection (3-4 sentences max).` with `You are writing a
   brief weekly reflection from someone's time log (3-4 sentences max).`
   Replace the line `Be warm but direct. Use "you" language. Reference
   specific data from their week.` with `Use "you" language. Reference
   specific data from their week.` followed by `${REVIEW_VOICE}`. Rename
   part 1 of the structure from "What went well" to "What the week held".
   Leave the three-part structure and the one suggestion in place.

5. **Stale lines.** In `commentaryFingerprint`
   (`src/lib/commentary-cache.ts`) add a module constant
   `PROMPT_VERSION = 2` as the first element of the hashed array, with a
   one-line comment saying to raise it when the prompt's voice changes. In
   `weekly-review/route.ts`, find where `coachFingerprint` is computed and
   add the same kind of constant to its input. If it is not a plain hash of
   inputs, leave it and say so in the build report.

6. **Wins block** (`WinsSection` in `DayReviewContent.tsx`):
   - Heading text is `What stood out` for every day (drop the `isToday`
     prop if nothing else uses it). Use the `eyebrow` class like other
     section headings; remove the `Trophy` icon.
   - The rows become one card: `rounded-xl border border-border bg-card
     divide-y divide-border`, each row `px-4 py-3 text-sm text-foreground`,
     no icon, no green tint. Delete `winIcons` and any imports left unused.
   - In `generateWins` (`day-summary/route.ts`) change `'Good balance of
     focus and rest'` to `'Focused work and rest both got time'`.
   - Update the four tests that look for `Today's Wins` to look for `What
     stood out`.

7. **Weekly highlights** (`WeeklyReviewContent.tsx` near line 330): delete
   the `<Trophy …/>` line and the `mt-1` on the text below it; remove the
   import if unused.

8. **Library** (`src/lib/library.ts`): replace the whole `time-paradox`
   object with:

   ```ts
   {
     id: 'progress-monitoring',
     kind: 'study',
     title: 'Does Monitoring Goal Progress Promote Goal Attainment?',
     author: 'Harkin, Webb, Chang and colleagues',
     year: 2016,
     finding:
       'A meta-analysis of 138 experiments, about 20,000 people: those prompted to track their progress towards a goal were more likely to reach it. The effect was small to moderate, and larger when the progress was written down. Most of the experiments were about health goals such as weight and diet, not about how a day is spent.',
     howWeUseIt:
       'The reason the app keeps a record. Writing down what a day held puts it next to what you meant it to hold. That the effect carries over from health goals to time is our inference, not the study’s.',
     link: 'https://doi.org/10.1037/bul0000025',
     metrics: [],
   },
   ```

   Search `src` for `time-paradox` and update any reference. Leave the
   file's header comment (it is history) and `docs/APP-REVIEW.md`.

9. **Averages.**
   - `src/lib/ideal-day.ts`, the 17–19 window: `reason` becomes `'Body
     temperature peaks — for most people, the best window for physical
     effort'`. Update the expected string in `suggest-times.test.ts`
     (line ~166) to match however the planner lowercases and joins it.
   - `DayWindowsCard.tsx`: `DialogDescription` becomes `What each part of
     the day tends to be best for, and why.`

10. **Guide and More copy.**
    - `settings/page.tsx` row description and `guide/page.tsx` subtitle:
      `Science-backed daily planning guide` → `What the research adds up
      to, hour by hour`.
    - Guide intro paragraph → `How the research suggests spending 16
      waking hours. The findings are averages across people, from circadian
      biology, cognitive science and well-being studies, and some are
      stronger than others. Where your own log disagrees, your log is the
      better guide.`
    - Callout "The 90-Minute Rule" → title `Blocks of about 90 minutes`,
      body `Attention tends to run in cycles of roughly 90 minutes. A
      focused block of about that length, then a 15–20 minute break, suits
      most people. The evidence for these cycles in waking hours is thinner
      than it is for sleep, so treat it as a starting point.`
    - Callout "Leisure Isn't Lazy" → title `Free time counts`, body `In
      one large study, well-being was lower for people with under about 2
      hours of free time a day, and also for those with more than about 5.
      Active leisure — hobbies, people, making things — held up better than
      passive.`

11. **Tests to add.**
    - `day-commentary.test.ts`: the prompt contains `No praise`, does not
      contain `warm`, and the existing wins-text assertion still passes.
    - `library.test.ts`: no entry's `author` contains `Zimbardo`; the
      `progress-monitoring` entry exists, has `metrics: []` and a
      `doi.org` link.

12. Run the checks under "Done when", then commit to `dev`. Do not push.

## Rules that apply

- Branches: work on `dev`; never touch `main`.
- Principle 2 (muted palette): colour is data or status, never decoration;
  the five coloured win icons and the green rows go.
- Principle 3 (minimal UI): a list is one card with `divide-y`; an icon is
  not decoration.
- Principle 5 (type scale): section heading uses `eyebrow`; nothing under
  12px.
- Principle 7 (one scoring system): add no number or score anywhere.
- Principle 9 (time-aware labels): no judging labels.
- Principle 12: the "averages across people" note in the windows sheet
  stays.
- AI calls: session check and rate limit in both routes stay as they are.

## Do not

- Do not touch `/api/commentary` (per-entry line) or
  `/api/period-commentary` (session popup). Their voice is a separate
  decision; see "Not decided".
- Do not add an evidence-strength label or field to the library, and do
  not edit any other library entry.
- Do not rewrite saved reviews in the database. Days already finalised
  keep the line they were saved with.
- Do not rename the `Win` type, its `type` values, or the `wins` field in
  the API.
- Do not change the windows themselves, their hours, or `windowsForWake`.
- Do not change the guide page's layout, colours or citations list.

## Done when

- `npx tsc --noEmit` passes.
- `npm test` and `npm run test:tz` pass, including the new assertions.
- `npm run lint` stays at 54 warnings, 0 errors (or fewer).
- `npm run build` passes.
- `grep -rn "Zimbardo\|Science-backed\|Today's Wins" src` finds only the
  history comment at the top of `src/lib/library.ts`.
- In the app: Review → a day not yet finalised shows a commentary line
  with no praise words; the block under it is headed "What stood out",
  one plain card. More → The Science opens on the Harkin study with a
  working doi.org link. Today → Your windows → the physical peak reads
  "for most people". More → Your Ideal Day shows the new subtitle.

## Not decided

- **The per-entry and session-popup voice.** Those prompts ask for a
  cheeky friend ("You crushed it", "Third TikTok session today. Come on.").
  That is at odds with "no hype, no guilt", but it was a deliberate choice.
  Owner to decide whether they move to the same plain voice.
- **Evidence-strength labels and a citation audit.** Nothing in the app
  labels how strong a finding is yet. Doing it honestly means checking all
  eight remaining sources first, and several look loose (the physical-peak
  window cites a paper about exercise and cognition, not time of day; the
  WHO/ILO entry mixes in the activity guideline; the "up to 40%"
  context-switching figure is credited to Deep Work). This wants its own
  plan, with the checking done by the planner, not the builder.

## Who should build and review this

- *Build with* **Sonnet**: every string and class is given; there is
  nothing to design.
- *Review with* **Opus**: prompts cannot be judged by tests alone, and the
  reviewer should read a few real generated lines against the voice rules.
- *Effort*: medium.
