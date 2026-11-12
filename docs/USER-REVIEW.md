# Better, from the user's seat

Reviewed 11 November 2026 at commit `8e3e5bf`.

## How this was tested

The real pages, API routes and scoring, driven in a browser at 375×812 as a
brand-new user, against an in-memory stand-in for the database. Calendar events
were two fixtures (a 9:30 standup and a 2:00 pricing review on weekdays). After
the first-run walk, nine earlier days were seeded so the reviews, the year grid
and repeat-session had something to show.

- No real account data was read or written, and nothing went to Google.
- About ten `gpt-4o-mini` calls were made on the project's OpenAI key, all on
  made-up activity text ("Pricing review", "built the pricing model").
- **Not covered:** the real Google sign-in and consent screen, push
  notifications, installing as a PWA, offline, and touch gestures on a real
  phone (drag on the open grid in particular).

## The purpose, and whether the app meets it

> Google Calendar holds commitments with other people. Better fits everything
> else around them, says why it chose each hour, then records what actually
> happened.

That sentence makes four promises.

| Promise | Verdict | Why |
|---|---|---|
| Read the calendar, never write to it | **Met** | Events arrive and are respected everywhere. Two holes: a lone event is invisible in the session view (B3), and a confirmed one is still listed as unconfirmed on Plan (B4). |
| Fit the unowned things around the fixed ones | **Half met** | The mechanics work: three tasks placed around two meetings in one tap. But it placed the gym at 6:00 AM for someone whose log shows they sleep until 7 and run at 6 PM, made every block exactly one hour, and you retype the same intentions every day. |
| Say why it chose each hour | **Half met** | Each suggestion carries a reason and a "why?" link. Tapping the link leaves the planner and throws the proposal away (B5), the reason disappears once accepted, and the library entry it opens explains scoring, not timing. |
| Record what actually happened | **Half met** | Capture is fast and pleasant. But the record cannot be corrected (B2), and it never meets the plan: Today does not show what you planned, and a plan logged exactly on time still counts as missed (B9). |

**The short version.** Capture, Plan and Review are each good rooms, and there
are no doors between them. The loop the app exists for is plan → do → record →
review → plan again, and it breaks at every joint:

1. **Plan → Today.** I planned tomorrow (gym, deep work, call home). Tomorrow's
   Today screen shows three zero rings and "Morning — Not logged". The plan is
   not there. "Your Plan" on the dashboard lists goals only and never reads the
   day's planned items.
2. **Today → Record.** The evening session knew I had "Run, 6:00 PM" planned and
   offered "Same as yesterday" instead. A planned item is never offered as
   something to confirm.
3. **Record → Review.** The Review tab is a padlock from midnight to 9 PM with
   no way to yesterday. When a review does open, the AI line describes a score
   the user cannot see (B7), and the plan section says "0 of 3 kept" beside two
   rows that say "you logged Ran 5k" at the planned hour.
4. **Review → Plan.** Nothing in either review leads to planning the next day.
   The weekly summary says "aim to schedule an hour of exercise" and offers no
   way to do it.

Closing those four joints is worth more than any single new feature. Everything
needed already exists; it is wiring.

## What already works — keep it

- **Quick log.** Two taps and a phrase. The start time defaults to where the
  last entry ended, and the "Pricing review ended at 3:00 PM" chip fills
  everything in one tap. This is the best interaction in the app.
- **Same as yesterday.** Three entries and ten hours in one tap.
- **Gap rows.** "3:00–5:27 PM · 2h 27m unaccounted" is the right question.
- **The three rings and their sheets.** "Why this is measured" with "4 sources
  behind this" is the app's character, and it lands.
- **Suggest times.** Instant, never on top of a meeting, reason attached.
- **Year in Pixels → day card → full day.** A clean drill-down.
- **The task tray.** Enter adds and keeps focus; three tasks in five seconds.
- **The look.** Calm, consistent, and it reads as one app.

## Bugs

**Status: all 21 below were fixed on 11 November 2026**, each checked in the
running app, with the test suite at 787 passing. Three more turned up while
fixing them and were fixed in the same pass:

- The weekly review never recognised the week in progress. The client asks
  for weeks that start on Monday; the server compared that with a Sunday it
  computed itself, so the two never matched, today was never left out, and a
  part-week was always set against a full one. This was the real cause of
  the "−49%" in B8.
- The weekly rings showed the trailing seven days, not the week on screen,
  so they could read Body 57 above a paragraph praising a Body of 92.
- `plan-tomorrow.test.tsx` had been failing since 5 November: it hard-coded
  "today" and "tomorrow" as dates.

One gap found and **not** fixed: on a day old enough to be locked (two or
more days back), the saved review does not carry the plan, so "Your plan"
disappears from that day's review.

Things that are wrong rather than matters of taste. Severity is from the user's
side: **High** breaks trust or a core flow, **Med** is visibly wrong, **Low** is
polish.

| # | Sev | What happens | Where |
|---|---|---|---|
| B1 | High | The time parser gets 8 of 20 everyday phrases wrong, including the input's own placeholder. See the table below. | `lib/time-parser.ts` |
| B2 | High | A category cannot be corrected. "Pricing review" came back as Deep Work; the edit form has no category field. Scores are built on categories, so a wrong one is a wrong score with no fix. | `TimeEntryModal.tsx` |
| B3 | High | A session with exactly one calendar event hides it: the confirm row needs two or more. The only trace is a gap that starts at an unexplained time. | `log/[period]/page.tsx` (`ghostEvents.length > 1`) |
| B4 | Med | On Plan, a calendar event that has been confirmed is listed twice — once as the entry, once still tagged CALENDAR. | `calendar/page.tsx` |
| B5 | High | "why?" on a suggestion navigates to the Library. Back returns to *today*, not the day being planned, with the suggestions gone. The planner's date is not in the URL. | `calendar/page.tsx` |
| B6 | High | A task added on Plan cannot be removed or unscheduled there. The sheet only offers "Update time block"; the one delete lives on the goal page. | `CommitTimeModal.tsx` |
| B7 | High | Yesterday's review opened with "It sounds like you had a challenging day" beside Body 92, Mind 75. The prompt is fed `Day Score` = sessions wrapped up ÷ sessions passed (0 here) and never sees the three scores. | `api/day-summary`, `api/day-commentary` |
| B8 | High | The weekly label comes from the retired formula (active days + entries per day): "Exceptional week" over Body 63 / Mind 51 / Heart 47, none on target. "Best day: 14.5h of focused time" is total logged time, seven hours of it sleep. On a Wednesday it compares three days with last week's seven: "−49% time logged", and the AI praised "reducing your total logged hours… a commendable focus on reclaiming your time". | `api/weekly-review/route.ts` |
| B9 | High | A plan counts as kept only if ticked in the session popup. "Run, 6 PM" with "Ran 5k" logged 6–7 PM is "missed". Header: "0 of 3 kept". | `lib/plan-adherence.ts` |
| B10 | Med | A session can be closed before it starts. At 5:35 PM: "Evening Complete · 0m · Great evening! You stayed on track." The row turns green, and the popup's "Your Day in Review is ready" leads to a card that says "Unlocks at 9:00 PM". | `PeriodSummaryPopup.tsx`, session page |
| B11 | Med | Straight after onboarding the dashboard says "No goals set yet" although the goal exists. It appears on reload: finishing onboarding only hides the modal, nothing refetches. | `page.tsx` → `YourPlan.tsx` |
| B12 | Med | Onboarding's last button, "Start logging", looks disabled (`bg-secondary hover:bg-secondary`). Introduced by the palette sweep in `70278f1`. | `OnboardingModal.tsx:361` |
| B13 | Low | In the session popup the share icon sits on top of the last letter of "Afternoon Complete". | `PeriodSummaryPopup.tsx` |
| B14 | Low | A future date on the dashboard shows sessions as "Not logged" and an unlocked "Your Day In Review". | `page.tsx` |
| B15 | Low | Metric sheets plot zeros for the days before you joined, then report "▲ 11 vs last week" and "Personal Best: 75" on day one. | `MetricDetailSheet.tsx` |
| B16 | Low | Past days show "Not wrapped up" in amber on every session, permanently. | dashboard session rows |
| B17 | Med | Login says "you agree to our Terms of Service and Privacy Policy". They are plain text; neither page exists. | `login/page.tsx:69` |
| B18 | Low | The info tooltip in onboarding opens on hover only, so it never opens on a phone. | `OnboardingModal.tsx` |
| B19 | Low | Layout at 375px: year-grid tiles clip "DAYS LOGGED"; "Morning Session" and "Sync Calendar" both wrap; the floating button covers the "Open the calendar" link; toasts cover the tab bar; a 15-minute event's label collides with the next block on the open grid; the first weekday label on the trend chart is cut off. | various |
| B20 | Low | Durations come in three formats on one screen: "1h", "2:28", "150 min". | `ActivityList`, day review |
| B21 | Low | The session popup's share and close buttons have no accessible name; the commit-time sheet has no close button and ignores Escape. (An earlier version of this row blamed Quick Log's buttons; on inspection those were already named.) | `PeriodSummaryPopup.tsx`, `CommitTimeModal.tsx` |

### B1 in detail

| Typed | Parsed as | Should be |
|---|---|---|
| `gym 12 to 1pm` | 1:00–2:00 PM, activity "gym 12 to" | 12:00–1:00 PM |
| `lunch 12-1pm` (the placeholder) | 1:00–1:00 PM, zero length | 12:00–1:00 PM |
| `run 6 to 7am` | 7:00–8:00 AM | 6:00–7:00 AM |
| `call mom 7-7:30pm` | 7:30–8:00 PM | 7:00–7:30 PM |
| `meeting from 10 to 11:30am` | 11:30 AM–12:30 PM | 10:00–11:30 AM |
| `dinner 7pm` | 7:00–7:00 PM, zero length | 7:00 PM + a default length |
| `studied for an hour` | nothing detected | 1 hour |
| `emails for half an hour` | activity left as "emails for" | "emails" |

One cause covers the first five: a range with am/pm on the second number only
loses its first number. That is how most people write a range.

## Where the app breaks its own rules

- **One scoring system (principle 7).** Three retired scores are still alive
  where the user can feel them: the weekly label (B8), the number the day
  commentary is written from (B7), and "0% weekly average · 0% priority done ·
  0 perfect days" on the goal page. The weekly stat tiles — Logged, Active
  Days, Entries — are the same "you showed up" measure.
- **Time-aware labels (principle 9).** It holds for negative labels and fails
  for positive ones: "Great evening!" 25 minutes before the evening (B10).
- **Colour has three jobs (principle 2).** Emoji bypass the palette: ✅ 📅 on the
  goal page and 🔥 ⭐ in the weekly review are the most saturated things in the
  app.
- **Planning and execution are separate (principle 10).** Kept, but at a cost
  nobody chose: execution never sees the plan at all.

## The walk, screen by screen

**Login.** "Track your time. Build better habits." could be any tracker. It does
not say what makes this one different, why it wants the calendar, or that
access is read-only.

**Onboarding.** Name, then a "choice" of one plan with Next disabled until you
tap the only card, then an 80% slider that nothing reads, backed by an uncited
"studies show". It never mentions sessions, the three scores, the calendar, the
planner or the review. The best explanation of the app's idea — "if someone
else is expecting you at a specific time → calendar; if it's your call when →
task" — is hidden on the goal page.

**Today, day one.** Three zeros and no hint what moves them. Nothing says what
to do next.

**Logging.** Good. Rough edges: the entry title is shown in capitals and
truncated ("BUILT THE PRICING M…"); gaps and entries are two separate lists, so
a 3:00 PM gap sits above the 2:00 PM entry it follows; three small gaps
after a repeat feel like being audited; nothing happens when you log — no ring
moves, nothing says the entry counted; "Logged 3 activities from yesterday" has
no Undo; editing takes two taps (view, then Edit); each log makes a redundant
second request just to write the word "Logged".

**Closing a session.** The line was "You really crushed it… in the zone… keep
that momentum going… definitely paying off" — four stock phrases and one fact.
The popup does not show what the session did to the rings, which is the one
thing worth showing.

**Review.** Covered above. Also: "Today's Wins" on a past day; the same
150-minute session reported three times on one screen (AI line, Wins, Longest
focus session); "Most time: Sleep (48%)" offered as an insight.

**Plan.** The tab says Plan, the page says Calendar. Two date navigators stacked
(arrows, then a week strip) use a quarter of the screen. Suggestions are not
drawn on the day band until accepted, so you cannot see the shape of the
proposed day. After accepting, a planned block looks the same as a calendar
ghost apart from a small label. No offer of a reminder.

**The goal page.** A second planner over the same tasks, with different powers:
delete, priority star and Google Tasks import exist only here; suggested times
exist only on Plan. With one goal on offer, the "goal" is a wrapper with
nothing inside.

**More.** The Science leads, which is right. "Plan & calendar" is still listed
under Preferences though it is now a main tab. Missing: notifications
(commented out), export my data, delete my account, privacy policy, and any
control over when the day starts — "Morning Session 12:00 AM – 12:00 PM" reads
oddly.

**Your Ideal Day.** A good page that never looks at you. It says deep work
should be 4–5 hours and does not say yours averaged 2.5.

## Suggestions, in order

### 1. Fix what is wrong

B1–B12 and B17. None is large. B2 (category picker) and B9 (infer "kept" from
the log) matter most, because they decide whether the numbers can be believed.

### 2. Join the loop

**Status: 1–5 built on 11 November 2026.** Today leads with *Next up*; each
session lists its own planned items; *Did it* logs the entry and keeps the
plan in one tap; the Review tab opens on yesterday until 9 PM with arrows
to other days; both reviews end by pointing at the planner. One change
from the list below: 4 was built as a "Planned" section inside the session
view, not as a single interleaved timeline of entries, gaps and events —
that is still open.

1. **"Next up" on Today.** Today's calendar events and planned items as one
   short list with a now-line, above the sessions. Each planned item gets three
   buttons: *Did it*, *Moved*, *Skipped*. This one change is the app's purpose
   made visible.
2. **One tap confirms and ticks.** *Did it* writes the entry at the planned
   time and marks the plan kept. Independently, treat a plan as kept when the
   log covers its window, and ask "Was this your run?" only when unsure.
3. **Review opens on yesterday until 9 PM**, with arrows to other days. End the
   day review with "Plan tomorrow".
4. **The session as one timeline.** Entries, gaps, calendar events and planned
   items interleaved in time order. The day visibly closes up as you fill it.
5. **Tell the AI the truth.** Give both commentaries the three scores and the
   plan outcome; delete `calculateDayScore` and the weekly `weekScore`. Compare
   a part-week with the same days of last week, or wait until it ends.

### 3. Make the planner yours

**Status: 7, 8 and most of 9 built on 11 November 2026; 6 in a lighter
form.** Suggestions use your usual hour and length from the last four weeks
of the log and never start before you are usually up; each proposal has
length chips and "Another time", is drawn on the day band in its colour,
and the plan is scored before it is lived. "why?" opens in place.

Not as written:

- **6 — standing intentions** ("Gym, 4× a week") would need a new table,
  which is a database migration. What was built instead needs none: "You
  often do" offers your recurring activities as one-tap tasks for the day
  being planned. It removes the retyping, but nothing proposes tomorrow on
  its own, and there are no weekly counts.
- **9 — keeping the reason on the planned row** is not built. Plans are
  stored without a category or a reason, so both are lost on reload.

6. **Standing intentions in place of the single goal.** "Gym, 4× a week, 60
   min." "Deep work, 2 hours, weekdays." "Call home, weekly." Set once; every
   evening the planner proposes tomorrow without typing. This is the goal page
   becoming what it was reaching for, and the two planners becoming one.
7. **Learn from the log.** The usual hour and length of each activity, and the
   wake time from sleep entries. Research picks between windows that suit
   *you*: "6:00 PM — when you usually run, and near the late-afternoon strength
   peak."
8. **A proposal you can shape.** Length chips before accepting, "another time"
   on each suggestion, the proposal drawn on the day band, and a forecast:
   "this plan lands Body ≈ 75, Mind ≈ 60".
9. **"why?" in place.** A sheet over the planner, not a trip to another page.
   Keep the reason on the planned row afterwards.

### 4. Make it feel good

10. **Logging should land.** The ring the entry feeds animates and the row
    shows "+12 Mind". Crossing 80 gets one quiet moment. This is the reward the
    app currently withholds.
11. **Undo on every toast** — log, repeat, confirm all, delete.
12. **Tap the category chip to change it**, and remember the correction: next
    time that text skips the model entirely. Cheaper, instant and consistent.
13. **Recents in Quick Log.** Your usual activities for this hour as chips.
14. **Commentary that earns its place.** One specific observation and what the
    day still needs ("Body is at 38; this evening is the last window"). When
    there is nothing to say, say nothing.
15. **Stop auditing.** Raise the gap minimum to 45–60 minutes, let a gap be
    dismissed, and drop "Not wrapped up" from days that are over.
16. **Small consistency.** One primary button style (it is white, tan and grey
    today); one date navigator on Plan; titles as typed, not capitalised;
    durations as "2h 28m" everywhere.
17. **Show me against the ideal.** Mark your own average on each bar of Your
    Ideal Day.

### 5. Before sharing it with friends

18. **Privacy policy and terms pages**, linked from login. Google's OAuth
    review asks for them too.
19. **Say "read-only"** on login and on Connected Accounts: "Better reads your
    calendar and never writes to it."
20. **Export my data and delete my account** in More.
21. **One kind of reminder: the plan.** "Run in 15 minutes." The generic
    "log your morning" nudges are the kind people switch off.
22. **Onboarding** (already deferred): finish with a planned tomorrow, not a
    slider. Remove the unused 80% target.
    **Built 12 November 2026:** four screens — name, what the app is for
    (shown against the person's own calendar), the three scores, and a
    first plan that opens the planner with times already proposed — then a
    three-step "Getting started" list on Today until the loop has been
    walked once. The slider is gone; the single default goal is still
    created silently, because the goal page depends on it.
