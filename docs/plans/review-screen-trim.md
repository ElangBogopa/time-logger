# Review screen: keep what helps, drop the rest

> **BUILT - do not run again.** Built on 2026-11-18 in the commit titled "Review screen: drop the unreadable strip, repeats and logging counts". It stays as the record of what was asked.

## Goal

The Review screen should show only what helps a person judge their day (or
week) and do better tomorrow. Take out the parts that are unexplained,
repeated or only measure how diligently someone logged: the coloured
"Your Day" strip nobody can read, the second "Plan tomorrow" button, the
"What stood out" block that repeats the longest-focus line, and the
logging-volume counts.

## What the owner sees today, and why each part goes or stays

Day tab (`src/components/review/DayReviewContent.tsx`, also rendered by
`/day-review`), top to bottom:

| Part | Decision | Why |
|---|---|---|
| Body / Mind / Heart rings, caption "2/3 sessions · 7h tracked" | Keep rings; caption becomes "7h logged" | "2/3 sessions" counts wrap-up popups closed: how diligently the day was logged (principle 7). The time logged stays, because it says how complete the log behind the scores is. |
| Coach line (`commentary` + `CommentaryThread`) | Keep | The one piece of judgment on the page. |
| "What stood out" (`WinsSection`) | Remove from the screen | The server only ever makes two wins: the longest focus session (the same fact as the "Longest focus session" card further down) and "Focused work and rest both got time" (filler). |
| "Your Day" strip (`TimelineStrip`) | Remove | Colours with no legend, coloured only by the first entry that *starts* in an hour (a 3-hour block shows as one coloured hour and two grey ones), 6:00–23:00 only. Whether things happened at the right hour is what "In your windows" answers, in words; the full day is on Today's timeline. |
| "In your windows" (`WindowAlignmentCard`) | Keep | Directly answers the app's question: did focus, exercise and people land in the hours that suit them. |
| "Your plan" (`PlanVsActualCard`) | Keep, move above "In your windows" | Plan kept / moved / missed is the most actionable fact at the end of a day. |
| Inline "Plan tomorrow" button (shown when the reviewed day is today) | Remove | This is the second "Plan tomorrow": `PlanNextCard` at the bottom also says "Plan tomorrow" on that same day. |
| "Longest focus session" card | Keep, drop the tinted circle around its icon | A real fact for a focus-minded person; the icon in a tinted circle is against principle 3. |
| `PlanNextCard` at the end | Keep | The one hand-off to the planner. |

New day order: rings, coach line, Your plan, In your windows, Longest focus
session, Plan tomorrow / Plan the rest of today.

Weekly tab (`src/components/review/WeeklyReviewContent.tsx`):

| Part | Decision | Why |
|---|---|---|
| "+12% time logged vs last week" line under the rings | Remove | Logging volume, not how the week went. |
| Three tiles: Logged / Active Days / Entries | Remove | All three measure logging diligence (principle 7). |
| Insight "Logged N% more/less time than last week" | Stop generating it | Same logging-volume fact. The other two insights ("Best focus: …", "Most waking time: …") stay. |
| Rings, "Best day" highlight, In your windows this week, coach summary + its Plan tomorrow button, Insights, Year in Pixels link | Keep | Unchanged. The weekly Plan tomorrow is the only one on that tab. |

## Files

- `src/components/review/DayReviewContent.tsx`
  - Delete the `TimelineStrip` component and its render (`<TimelineStrip timeline={summary.timeline} />` and the `div` around it).
  - Delete the `WinsSection` component and its render (`{summary.wins.length > 0 && ...}`). Keep the `Win` interface and `wins` in `DaySummary`: they are still sent to `/api/day-commentary` and saved by `saveReview`.
  - Delete the inline "Plan tomorrow" button (the block guarded by `summary.date >= getUserToday()`, with "Give tomorrow&apos;s tasks a time").
  - Rings caption: in both branches (the `caption` prop of `MetricRingRow` and the fallback `<p>`), show `` `${formatMinutes(summary.totalMinutesLogged)} logged` `` with no sessions count.
  - Move the "Your plan" section (`summary.productivityScore?.hasPlans && <PlanVsActualCard …/>`) above the "In your windows" block.
  - "Longest focus session" card: replace the `div` with `AGGREGATED_CLASSES.focus.tint` around the `Clock` icon with the bare icon, `className="h-5 w-5 shrink-0 text-muted-foreground"`. Add `mb-6` to its `section` so it does not sit flush on `PlanNextCard`'s `mt-6` (keep spacing consistent with the other sections; either margin is fine as long as there is one gap).
  - Remove imports that become unused (`Calendar` from lucide; `cn` only if nothing else uses it — `AggregatedBreakdownSection` and `CategoryBreakdownSection` still do, so it most likely stays). Leave the commented-out Energy/Category/Mood block and those dead components as they are.
- `src/components/review/WeeklyReviewContent.tsx`
  - Delete the `weekChange` constant and the block under the rings that renders it (TrendingUp / TrendingDown / Minus and "time logged vs …").
  - Delete the "Stats Grid" (`grid grid-cols-3` with Logged / Active Days / Entries).
  - Remove imports that become unused (`TrendingUp`, `TrendingDown`, `Minus`, `STATUS_CLASSES` if unused, `formatMinutes` helper if unused). Leave the `WeeklyReviewData` interface fields as they are (the API still returns them).
- `src/app/api/weekly-review/route.ts`
  - Delete the `if (hasPreviousWeekData && previousWeekMinutes !== null) { … insights.push(\`Logged …\`) }` block. Do not touch anything else in the response or the coach prompt; `previousWeekMinutes` etc. stay in the response.
- Tests (update, do not weaken):
  - `src/__tests__/day-review-embedded-chrome.test.tsx`: `ready()` waits for "What stood out"; wait instead for the caption (fixture's `formatMinutes(totalMinutesLogged)` + " logged", e.g. `/ logged$/` or the exact string). In "still renders the review itself", drop the win-text and `/2\/3 sessions/` expectations and expect the "… logged" caption instead.
  - `src/__tests__/day-review-commentary-loop.test.tsx` and `src/__tests__/review-window-alignment.test.tsx`: same change of anchor from "What stood out" to the caption.
  - `src/__tests__/day-review.test.tsx`: in "leads with the day's three metrics", replace `/2\/3 sessions/` with the "7h logged" caption (fixture has 420 minutes) and add `expect(screen.queryByText(/sessions/)).not.toBeInTheDocument()`. Leave the `it.skip` tests alone.
  - New tests in `src/__tests__/day-review.test.tsx`:
    1. Reviewing today after 9pm (fixture `date` = today, clock at 21:30 via jest fake timers or the file's existing time mocking) shows exactly one element matching `/^Plan tomorrow$/` (`getAllByText(...).length === 1`).
    2. With a summary whose `timeline` has entries and `wins` non-empty, neither "Your Day" nor "What stood out" is rendered, and the win's text is not on screen.
  - A weekly test, in a new `src/__tests__/weekly-review-content.test.tsx` or alongside the weekly rendering in `review-window-alignment.test.tsx` if it already renders `WeeklyReviewContent` with mocks: with `previousWeekMinutes` set, "Active Days", "Entries" and "time logged vs" are not on screen. And in `src/__tests__/api/weekly-review-cache.test.ts`, one assertion that no item in `res.body.insights` starts with "Logged ".

## Steps

1. `git branch --show-current` is `dev`.
2. Day review edits in `DayReviewContent.tsx`, in the order listed under Files. Run `npx tsc --noEmit`.
3. Update the four day-review test files' anchors and expectations; add the two new day tests. `npm test -- day-review review-window-alignment` passes.
4. Weekly edits in `WeeklyReviewContent.tsx` and the insight block in `weekly-review/route.ts`; add the weekly tests. `npm test -- weekly` passes.
5. Full checks (see Done when).

## Rules that apply

- Principle 7 (one scoring system): nothing shown should measure how diligently someone logged; this change removes the remaining logging-volume figures from Review.
- Principle 2 (muted palette, colour has three jobs): colour that encodes data must be readable; the strip's unexplained colours go rather than gain a six-entry legend.
- Principle 3 (minimal UI): no icon in a tinted circle; one primary hand-off per decision — one "Plan tomorrow" per screen.
- Principle 8 (no loading flash): do not change any caching in either component.
- Principle 9 (time-aware labels): no new labels are added.
- The four tabs are one loop and both reviews end by pointing at the planner: `PlanNextCard` stays at the end of the day review; the weekly Plan tomorrow stays.

## Do not

- Do not change `/api/day-summary`, `/api/day-review`, `/api/day-commentary` or what they store or send. Wins, timeline and breakdowns stay in the data (saved reviews hold them; the coach is told the wins).
- Do not change the weekly coach prompt, `buildWeekReviewContext`, `PROMPT_VERSION` or `COACH_PROMPT_VERSION` (the removed insight was never in the prompt).
- Do not touch `PeriodSummaryPopup.tsx`, the Today screen, or `WindowAlignmentCard.tsx`.
- Do not add a legend, a new chart, or any new section. Nothing is added to the screen.
- Do not delete the commented-out Energy / Category / Mood block or its components.

## Done when

- `npx tsc --noEmit` clean.
- `npm test` passes, including the new tests; `npm run test:tz` passes.
- `npm run lint` at or below its current count (note the count before starting).
- `npm run build` succeeds.
- In the app (`npm run dev`, phone width): Review → Day on a logged day shows, in order, the three rings with "Xh Ym logged" under them, the coach line, Your plan (if any plans), In your windows, Longest focus session (if ≥ 30 min, plain icon), and one Plan card. No "Your Day" strip, no "What stood out". After 9pm on today's review there is exactly one "Plan tomorrow". Review → Weekly has no "time logged vs last week" line, no Logged / Active Days / Entries tiles, and no "Logged N% more time" insight.

## Not decided

nothing

## Who should build and review this

- *Build with* **Sonnet**: removals and test-anchor changes, every one named above.
- *Review with* **no review needed**: the whole change is visible on the two Review tabs; the one server line removed only drops a display string. (`/do-all` reviews it anyway, on Opus.)
- *Effort*: medium.
