# Heart counts time with friends or family, whatever the activity

> **BUILT - do not run again.** Built on 2026-11-16 in the commit titled "Heart counts time with friends or family, whatever the activity". It stays as the record of what was asked.

## Goal

Time spent with friends, family or a partner counts toward Heart whatever
the activity was. If an entry's words say it was done with them ("video
games with friends", "dinner with family", "gym with a friend"), its full
duration counts toward Heart as well as toward its own category, and the
entry keeps its own category and colour. Every place that counts time with
people (the ring, the reviews, the plan prediction and the windows card)
agrees, and opening such an entry shows one quiet line saying so.

## What was found before planning (do not re-investigate)

- Heart is `calcSocial(dayEntries)` in `src/lib/metrics-calc.ts`. It sums
  `duration_minutes` of entries whose category is in
  `SOCIAL_CATS = ['social', 'calls', 'faith']`, then
  `saturatingScore(minutes, SOCIAL_TARGET)`. `calcSocialDetails` gives
  `{ totalMinutes, breakdown }` for the detail sheet.
- `EntryRow` already has `activity?: string`. Every caller of `calcSocial`
  already passes rows that carry `activity`:
  - `src/app/api/metrics/trend/route.ts` selects `activity`. This is the
    ring on Today (`DashboardHero`), the detail sheet (`MetricDetailSheet`)
    and the rings on both reviews.
  - `src/app/api/day-summary/route.ts` and `src/app/api/weekly-review/route.ts`
    select `*`.
  - `src/app/api/year-pixels/route.ts` selects `activity`.
  - The plan prediction ("If the day goes to plan") is the `forecast` memo in
    `src/app/calendar/page.tsx` (around line 693). Its `add(category,
    minutes, activity)` puts the entry's activity, the calendar event title
    or the task title into the row.
  So changing `calcSocial` and `calcSocialDetails` moves the ring, the
  detail sheet, the review rings, the week's "Best day" line, the year grid
  and the plan prediction together. None of them needs its own edit.
- `src/app/api/metrics/route.ts` (no `/trend`) is not fetched by anything,
  but it sums social minutes inline with `SOCIAL_CATS`. Make it use
  `calcSocialDetails` so it cannot disagree.
- The week review decides whether to add `NO_FRIENDS_OR_FAMILY` in
  `buildWeekReviewContext` (`src/lib/prompts.ts`) from
  `peopleMinutes(input.categories)`, which sums by category label only. It
  would still say "No time with friends or family" for a week whose only
  time with people was "dinner with family" logged as Meals. That is the one
  review change needed.
- The day review prompt (`buildDayReviewPrompt`) says nothing about time
  with people. It never says there was none, so it needs no change.
- The windows card works from `windowAlignment(entries, windows)` in
  `src/lib/window-alignment.ts`. Its `people` group is
  `categories: ['social', 'calls']`. An entry's suited windows are the ones
  whose `categories` include the entry's category. `AlignmentEntry` has no
  `activity`. Callers:
  - `DayReviewContent.tsx` (line ~501) passes `summary.entries` (full
    `TimeEntry`s) or `habitHistory` rows (these have `activity`, see
    `src/lib/habits.ts`).
  - `WeeklyReviewContent.tsx` (line ~133) passes `useWeekEntries(...)`
    (`src/hooks/useWeekEntries.ts`). That hook **drops** `activity` when it
    maps rows, so it must keep it.
- The entry sheet is `src/components/TimeEntryModal.tsx`. The category pill
  is rendered at lines ~514–537 for `!isPending && entry.category`.
- `npm run lint` currently reports 0 errors and 49 warnings.
- `COACH_PROMPT_VERSION = 9` is in `src/app/api/weekly-review/route.ts`.
  `PROMPT_VERSION = 5` is in `src/lib/commentary-cache.ts`.

## Decided

- **The rule is read from the words.** It applies to every entry, old and
  new, confirmed (the only kind any score counts). Nothing is stored, so
  there is no migration, no new column and nothing new to export or delete.
- **Counted once.** An entry counts toward Heart if its category is in
  `SOCIAL_CATS` **or** its text says friends or family. It is never counted
  twice: "call with mom" in Calls is 60 minutes, not 120.
- **Full duration, no discount.** The same Heart curve and target. No new
  formula.
- **Work words never count.** They are simply not in the list of people
  words. They do not veto a people word in the same phrase: "lunch with my
  team and my sister" counts, because of "sister".
- **A bare name never counts.** "gym with Thabo" does not count. "gym with
  Thabo and his brother" does, because of "brother".
- **"partner" counts only after "my" or "our"** ("with my partner"), because
  "with a partner" and "with partners" are usually work. "partners" never
  counts.
- **"w/" is read as "with".**
- **The Heart detail sheet** shows these minutes as one row,
  "With friends or family". Without it, the sheet's minutes would not add up
  to the ring. The row is keyed `with_friends_or_family` in
  `calcSocialDetails().breakdown`. Entries already in Social, Calls or Faith
  stay under their own category key.
- **The windows card**: an entry that counts through its words, and whose
  category is not Social or Calls, joins the "Time with people" group. Its
  suited windows are the windows whose `bucket` is `'connection'` (Midday,
  with people; People). An entry like "gym with friends" counts in both
  Exercise and Time with people. Faith stays out of the people group as
  today.
- **The entry line**: on a confirmed entry whose category is not in
  `SOCIAL_CATS` and whose text counts, directly under the category pill:
  `Also counted toward Heart, as time with friends or family.` It uses
  `text-sm text-muted-foreground`, has no icon and no colour, and is not a
  button. It is not shown on pending entries, on Social/Calls/Faith entries,
  or in edit mode. Use `METRIC_LABELS.social` for the word "Heart". The
  timeline block is unchanged.
- **Prompt versions**: both `COACH_PROMPT_VERSION` (9 → 10) and
  `PROMPT_VERSION` (5 → 6) are raised, as CLAUDE.md requires for any change
  to what the reviews are told. Only the week context actually changes.

## Files

- `src/lib/metrics-calc.ts`
  - New `withFriendsOrFamily(activity?: string | null): boolean`. The
    matcher is described in Step 1.
  - New `countsTowardHeart(entry: { category: string; activity?: string | null }): boolean`
    returns `SOCIAL_CATS.includes(entry.category) || withFriendsOrFamily(entry.activity)`.
  - New `heartMinutes(entries: EntryRow[]): number` returns the sum of
    `duration_minutes` over entries where `countsTowardHeart`.
  - New exported constant `WITH_FRIENDS_OR_FAMILY_KEY = 'with_friends_or_family'`.
  - `calcSocial` becomes `saturatingScore(heartMinutes(dayEntries), SOCIAL_TARGET)`.
  - In `calcSocialDetails`, an entry in `SOCIAL_CATS` goes under its
    category as now. Otherwise, if `withFriendsOrFamily(entry.activity)`, it
    goes under `WITH_FRIENDS_OR_FAMILY_KEY`. `totalMinutes` includes both.
  - Rewrite the "Heart category groups" comment so it says what counts and
    why: words, not only category, because an entry is one category and
    "video games with friends" gave Heart nothing.
- `src/app/api/metrics/route.ts`: replace the inline `socialMinutes` and
  `socialBreakdown` with `calcSocialDetails(todayEntries)`. Drop the
  `SOCIAL_CATS` import if it is no longer used.
- `src/components/MetricDetailSheet.tsx`: add
  `[WITH_FRIENDS_OR_FAMILY_KEY]: { label: 'With friends or family' }` to
  `SOCIAL_CATEGORY_INFO`.
- `src/lib/prompts.ts`
  - `WeekReviewContextInput` gets `heartMinutes?: number`, with the doc
    comment "Minutes the Heart ring counts this week, from the entries. When
    given, it decides the no-friends-or-family sentence instead of the
    category labels."
  - In `buildWeekReviewContext`, `noneThisWeek` uses
    `(input.heartMinutes ?? peopleMinutes(input.categories)) === 0` in
    place of `peopleMinutes(input.categories) === 0`. Keep the other
    conditions.
  - Update the "What the reviews say about time with friends and family"
    comment and the `peopleMinutes` doc comment. `peopleMinutes` sums labels
    only, and the route passes `heartMinutes` so an entry's words count too.
- `src/app/api/weekly-review/route.ts`: pass
  `heartMinutes: heartMinutes(entries.filter((e) => e.category) as unknown as EntryRow[])`
  to `buildWeekReviewContext`. Import `heartMinutes`. Raise
  `COACH_PROMPT_VERSION` to 10.
- `src/lib/commentary-cache.ts`: raise `PROMPT_VERSION` to 6.
- `src/lib/window-alignment.ts`
  - `AlignmentEntry` gets `activity?: string | null`.
  - In `windowAlignment`, for the `people` group, an entry qualifies if its
    category is in the group's categories, **or** if
    `withFriendsOrFamily(entry.activity)` is true. For an entry that
    qualifies only through its words, `suited` is the windows with
    `window.bucket === 'connection'`. Everything else is unchanged. Keep the
    file's header comment and add a line about this.
- `src/hooks/useWeekEntries.ts`: include `activity: row.activity` in the
  mapped `AlignmentEntry`. The cache key stays: an old cached week without
  `activity` is replaced on the background refresh.
- `src/components/TimeEntryModal.tsx`: the line, as decided above, inside
  the `!isPending && entry.category` fragment, after the pill button and
  before the category picker. Import `SOCIAL_CATS`, `METRIC_LABELS` and
  `withFriendsOrFamily` from `@/lib/metrics-calc`.
- `scripts/eval/review-voice.eval.ts`
  - Add a finished-week scenario `friends-in-leisure`:
    `[['Sleep', 54], ['Entertainment', 14], ['Meals', 9], ['Deep Work', 12]]`
    with `{ heartMinutes: h(6) }` (the games and dinners were with friends).
  - Where `checkReviewLine` is given `peopleMinutes`, and in the
    "Full-week lines with no time with friends or family" count, use
    `scenario.input.heartMinutes ?? peopleMinutes(...)` for week scenarios.
- `CLAUDE.md`: replace the bullet that begins "The reviews count time with
  friends or family as the Heart ring does" with:
  "Time with friends or family is what the Heart ring counts: Social, Calls
  and Faith, plus any entry whose words say it was with friends, family or a
  partner (`withFriendsOrFamily` in `lib/metrics-calc.ts`). Such an entry
  counts its full duration toward Heart and keeps its own category. Work
  words ("with colleagues", "with a client") and bare names ("gym with
  Thabo") do not count, and work meetings are not time with friends or
  family. The ring, the reviews, the plan prediction and the windows card
  all count it this way. The day review never says there was none; a
  finished week with none is told so in a sentence (`NO_FRIENDS_OR_FAMILY`),
  never a label and a colon."
- New tests: see Steps.

## Steps

1. **The matcher** (`withFriendsOrFamily` in `metrics-calc.ts`):
   1. Return false for an empty or missing text. Lowercase it, turn `’`
      into `'`, and replace `\bw/\s*` with `with `.
   2. Split into clauses on `[,.;:!?()|+]`.
   3. In each clause, for every whole-word `with` (`/\bwith\b/g`; this
      leaves out "without", "within" and "withdraw"), take the words that
      follow, split on whitespace. Take at most 6, and stop early at any of
      `for about at in on to from then before after while during via over`.
   4. Clean each word: strip a trailing `'s` or `s'`, strip characters other
      than letters, hyphens and accented letters, and cut
      `-in-law`/`-in-laws` to the part before it (but keep `in-laws` itself
      as a word).
   5. Return true if a cleaned word is in `PEOPLE_WORDS`, or is `partner`
      with the word before it being `my` or `our`.
   `PEOPLE_WORDS` is a `Set` written out in full, singular and plural, with
   no stemming:
   friend friends bestie besties bff buddy buddies pal pals mate mates
   family families fam mom moms mum mums mommy mummy mother mothers dad
   dads daddy father fathers parent parents brother brothers sister sisters
   sibling siblings son sons daughter daughters kid kids child children baby
   grandma grandpa grandmother grandfather grandparents granny gran nan nana
   grandson grandsons granddaughter granddaughters grandkids grandchildren
   aunt aunts auntie aunty uncle uncles cousin cousins niece nieces nephew
   nephews in-laws wife husband spouse boyfriend girlfriend fiance fiancee
   fiancé fiancée gf bf stepmom stepdad stepmother stepfather stepbrother
   stepsister.
   Work words (colleague, coworker, client, team, boss, manager, partners)
   are deliberately absent. Write a comment saying so.
2. Add `countsTowardHeart`, `heartMinutes` and `WITH_FRIENDS_OR_FAMILY_KEY`,
   and change `calcSocial` and `calcSocialDetails`. Run
   `npx jest src/lib/__tests__/heart-metric.test.ts`. It must still pass
   unchanged.
3. Add `src/lib/__tests__/with-friends-or-family.test.ts`, a table of
   activity → expected:
   - true: "Video games with friends", "Dinner with family", "Gym with a
     friend", "gym with friends", "Lunch with my brother", "Coffee with mom",
     "Walk with my wife", "Park with the kids", "Dinner w/ the fam",
     "Brunch with my mother-in-law", "Movie with my partner", "Gym with Thabo
     and his brother", "Lunch with my team and my sister", "Call with Mum",
     "Board games with friends, then bed".
   - false: "Lunch with colleagues", "Call with a client", "Sync with my
     team", "Gym with Thabo", "Gym without friends", "Dinner without
     family", "Worked within the family business hours" (no whole-word
     `with`), "Meeting with partners", "Meeting with a partner", "Friends
     episode" (no "with"), "Family admin" (no "with"), "Gym", "", null,
     undefined, "Lunch with colleagues about family leave policy" (stops at
     "about").
4. Extend `src/lib/__tests__/heart-metric.test.ts`:
   - `[{ category: 'entertainment', activity: 'Video games with friends', duration_minutes: 60 }]`
     gives `calcSocial` = 80 and `calcFocus` = 0.
   - `[{ category: 'exercise', activity: 'Gym with friends', duration_minutes: 45 }]`
     gives `calcSocial` > 0 and `calcBody` equal to `calcBody` of the same
     row with activity "Gym". Body is unchanged by the words.
   - "Lunch with colleagues" (meals, 60) and "Gym with Thabo" (exercise, 60)
     give `calcSocial` = 0.
   - `{ category: 'social', activity: 'Dinner with family', duration_minutes: 60 }`
     gives 80, not 96 (counted once).
   - An entry with no `activity` (an old row shape) still scores by category.
   - `calcSocialDetails` puts "Dinner with family" (meals, 60) under
     `WITH_FRIENDS_OR_FAMILY_KEY` with `totalMinutes` 60, and a Calls entry
     under `calls`.
5. Change `src/app/api/metrics/route.ts` and `MetricDetailSheet.tsx`.
6. Change `prompts.ts` and the weekly route. Raise both prompt versions.
   Extend `src/lib/__tests__/review-week-context.test.ts`:
   - A finished week with categories `[{ label: 'Meals', minutes: 600 }]`
     and `heartMinutes: 120` does not contain `NO_FRIENDS_OR_FAMILY`.
   - The same with `heartMinutes: 0` does contain it.
   - With `heartMinutes` omitted, it falls back to the labels (the existing
     tests keep passing).
7. Change `window-alignment.ts` and `useWeekEntries.ts`. Extend
   `src/__tests__/window-alignment.test.ts`, using the windows the existing
   tests use:
   - An entertainment entry "Video games with friends" from 19:30 to 20:30
     gives a `people` fact with `totalMinutes` 60 and `inWindowMinutes` 60.
   - An exercise entry "Gym with friends" appears in both the `movement` and
     the `people` facts.
   - "Gym with Thabo" gives no `people` fact.
8. Add the line to `TimeEntryModal.tsx`. Add
   `src/__tests__/entry-heart-line.test.tsx` (render the modal the way
   `src/__tests__/toast-behavior.test.tsx` does). The line
   `Also counted toward Heart, as time with friends or family.` is shown for
   a confirmed entertainment entry "Video games with friends". It is not
   shown for a confirmed "Gym with Thabo", for a confirmed social entry
   "Dinner with family", or for a pending "Video games with friends".
9. Update `scripts/eval/review-voice.eval.ts`. If `OPENAI_API_KEY` is set,
   run `npm run eval:voice` and confirm that the `friends-in-leisure` lines
   do not say there was no time with friends or family, and that
   `docs/voice-lines/after.md` was rewritten. If the key is not set, say so
   in the build report and do not fake the file.
10. Update `CLAUDE.md` as given under Files.
11. Run every check in "Done when".

## Rules that apply

- CLAUDE.md "AI API Calls": the bullet on what the reviews count as time
  with friends or family. The owner agreed to extend it, and this change
  rewrites it. `npm run eval:voice` and raising `PROMPT_VERSION` and
  `COACH_PROMPT_VERSION` apply.
- Principle 7, one scoring system: Heart stays `calcSocial` with the same
  target and curve. Only the minutes it is given change. No new score.
- Principle 12: the windows card stays a fact and a bar, with no new ring.
- Principle 2, muted palette: the entry line is neutral text. No new colour,
  and the timeline block is unchanged.
- Principle 5, type scale: `text-sm text-muted-foreground`, no opacity
  suffix.
- Dates: untouched. No `toISOString()` anywhere in this change.
- "A new table is also something to export and to delete": not triggered,
  because nothing new is stored.

## Do not

- Do not change an entry's stored category, colour or timeline block, or
  write anything to the database.
- Do not change `SOCIAL_TARGET`, `saturatingScore`, the Heart curve or
  `SOCIAL_CATS`.
- Do not ask the person later whether an unclear activity was with friends,
  and do not try to recognise bare names (out of scope).
- Do not ask the categoriser (`/api/categorize`) to change how it
  categorises, or call any model for this. The rule is plain text matching.
- Do not change `buildDayReviewPrompt` or `REVIEW_VOICE`.
- Do not add faith to the windows card's people group.
- Do not touch `main`.

## Done when

- `npx jest src/lib/__tests__/with-friends-or-family.test.ts src/lib/__tests__/heart-metric.test.ts src/lib/__tests__/review-week-context.test.ts src/__tests__/window-alignment.test.ts src/__tests__/entry-heart-line.test.tsx` passes.
- `npx tsc --noEmit` is clean.
- `npm test` passes and `npm run test:tz` passes.
- `npm run lint` reports 0 errors and still 49 warnings or fewer.
- `npm run build` succeeds.
- `npm run eval:voice` has been run, or the report says the key was missing.
- In the app (dev server or preview):
  - Log "Video games with friends" for an hour. It stays an Entertainment
    block, and the Heart ring on Today rises.
  - Log "Gym with friends". Body and Heart both rise.
  - Log "Lunch with colleagues" and "Gym with Thabo". Heart does not move.
  - An existing "Dinner with family" entry on an earlier day now shows in
    that day's Heart (Review tab), and the Heart detail sheet lists it as
    "With friends or family".
  - On the Plan tab, a planned task or calendar event "Dinner with mom"
    raises Heart in "If the day goes to plan".
  - Opening "Video games with friends" shows the quiet line under the
    category. Opening "Gym with Thabo" or a Social entry shows none.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**. Every file, function, word list and test is named
  here, so the remaining work is careful editing, not judgment.
- *Review with* **Opus**. It changes a score shown everywhere, and a review
  should check that the matcher's misses and false hits are sensible and
  that no counting place was left out. It does not touch sign-in, data
  deletion or the database's shape, so Fable is not needed.
- *Effort*: medium.
