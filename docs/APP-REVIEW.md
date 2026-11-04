# Better — app review

Written 3 Nov 2026, after walking the live app and reading the codebase. Where
a claim comes from measurement it says so; where it is judgement it says that
too.

---

## 1. What you have

A time tracker with a point of view. That is rarer than it sounds: most
personal trackers are stopwatches with a category list, and most "life" apps
are mood diaries. Better logs where time went, categorises it with a model,
scores it as Body / Mind / Heart, and then talks to you about it.

47 API routes, ~34,000 lines, 30 test suites, PWA with offline support, push
notifications, two cron jobs, Google Calendar import, Google Tasks import,
Sentry, and a separate Expo app.

**The three things genuinely worth protecting:**

1. **The Library.** "The Science" page cites Zimbardo on the perception gap,
   WHO on working hours, the Harvard study. No competitor I looked at
   explains *why* its metrics exist. This is the most defensible thing in the
   product and it is buried behind Settings → More.
2. **Conversational commentary.** Being able to argue with the AI about your
   own day is novel. Within an hour of shipping it, it surfaced a scoring bug
   nothing else had caught.
3. **The scoring model.** Body / Mind / Heart with a saturating curve, each
   weight defensible out loud. Most trackers show you hours; this makes a
   claim about them.

---

## 2. Where it sits against comparable apps

| | how they handle categories | the gap you fill |
|---|---|---|
| **aTimeLogger, ATracker** | user-defined, no fixed taxonomy | they never interpret; you do |
| **RescueTime** | fixed, but about software: Email, Software Development. Categories "cannot be renamed or removed" | it only sees a screen; your day includes the gym and dinner |
| **Toggl, Clockify** | projects and clients, built for billing | not about a life |
| **Daylio** | mood first, activities as icons | no time, no duration |
| **Hallow, Muslim habit trackers** | faith as a first-class streak | you now have a faith category; they have the ritual |
| **Whoop** | Strain 0–21, logarithmic, personalised | same scoring philosophy, applied to time rather than heart rate |

**The honest positioning:** you are not competing with time trackers. You are
building the Whoop of time — a daily number with a defensible model behind it
and a coach that explains it. Nothing in the list above does that.

**The closest real risk** is RescueTime, which added AI insights in 2026 and
already has automatic capture. Their weakness is permanent: they can only see
the computer. Yours is manual entry, which is a real cost to the user every
day. That asymmetry decides the product — see §4.

---

## 3. UI: what is holding it back

Observations from the live app at desktop width and at phone width.

**Everything looks the same.** Dashboard is a vertical stack of rounded cards,
each with an icon circle, a title, a subtitle and a chevron. Your Day In
Review, the three sessions and the goal are all rendered identically, so
nothing tells you where to look. The rings are the only element with any
visual weight.

**The palette contradicts your own rules.** CLAUDE.md says "Muted palette:
Slate/zinc tones, no bright neons. Category colors are desaturated." The
dashboard rings are saturated green / blue / orange with a glow, and completed
sessions are filled with a heavy green tint. Meanwhile day-review uses a
genuinely muted set (`#6B8CAE`, `#8B8680`, `#7D9B8A`). Two palettes, one app.

**Section headers are too quiet.** `YOUR DAY`, `SESSIONS`, `YOUR PLAN` are
~10px uppercase at low contrast. They carry the page's structure and are the
least visible thing on it.

**No desktop layout.** The app is a 420px column centred in a 1920px window,
with the rest black. At phone width it is well proportioned; on a laptop it
looks unfinished. A two-column layout above ~900px — rings and sessions left,
review and plan right — would cost one breakpoint.

**Year in Pixels wastes its own idea.** The grid is 12 columns × 31 rows, so a
year is a long scroll through mostly empty space. The established idiom
(GitHub contributions) is weeks as columns and days as rows: 7 rows, the whole
year visible at once, immediately legible. Same data, a fifth of the height.
*(Done — `lib/pixels-grid.ts`. A row is now a weekday, which the old 31-row
grid could not express: the 14th of one month is not the same weekday as the
14th of the next.)*

**Typography is the browser default.** `ui-sans-serif, system-ui`. For an app
whose whole pitch is considered judgement about your life, one typeface with
some character — and a real type scale rather than Tailwind defaults — would
do more for perceived quality than any other single change.

**Small things:** emoji in product copy ("All metrics looking strong. Keep it
up! 🔥") sits oddly against the restrained tone everywhere else; the app name
"BETTER" is letter-spaced above the rings where it reads as a label for them;
every row has a chevron, including ones that are not very important.

---

## 4. Features worth adding, in order

**1. Reduce the cost of logging.** This is the whole game. Every competitor
with automatic capture beats you on friction, and your own data shows it: 3
days logged out of the last 21. Concretely —
   - ~~A one-tap "same as yesterday" for recurring blocks.~~ Done: an empty
     session offers the most recent day whose matching session was logged,
     and copies it — categories included, so it costs no model calls.
   - Templates for a standard working day. *Not done: "same as yesterday"
     covers the same ground for a person who logged recently, and a template
     library is worth building only if that turns out not to be enough.*
   - ~~Confirm-all for calendar ghosts, instead of one at a time.~~ Done: one
     categorise call and one insert for the set.
   - Natural-language entry. *Partly there already: the quick-log modal
     parses times out of what you type ("coded for 2 hours") client-side. The
     deleted `/api/parse-activity` was the model-backed version, and is still
     one `git revert` away if the local parser proves too literal.*

**2. Make the Library the front door.** Move it out of Settings. Each metric
in the detail sheet should link to the research behind it. The reason to
believe your numbers is sitting in a page nobody visits.

**3. Give the commentary thread a home on the entry and the week.** The API
already supports `entry` and `week` subjects; only `day` and `session` have UI.

**4. Weekly review as the hero.** Daily numbers are noisy at 3 days of data a
week. The weekly coach summary is the most valuable thing the model produces
and it lives behind a tab.

**5. An honest empty state.** With no entries, the dashboard shows three
zeros, which reads as failure rather than as "nothing logged yet". Zero and
unknown are different states and should look different.

---

## 5. What shows the app's age

You asked what an older model left behind. The tell is not style — it is
**duplication of concepts that should exist once**. Found and removed in the
last two days:

- `Win` declared three times, two of them wrong — one rendered blank rows
- `Goal` declared twice with different shapes
- `CATEGORY_TO_AGGREGATED` in three files
- `AGGREGATED_COLORS` in three files, one typed `Record<string, …>` so the
  compiler could not catch a missing key
- The Focus weights in two files, so a category could be scored and then left
  out of the breakdown explaining it
- `/api/metrics` scoring the day itself instead of calling the shared
  functions — and scoring Body differently from the trend route
- 23 unreachable modules, a 906-line `.backup` file, 7 dead endpoints

Each was written to work, and did. The cost only appears on the day you change
a shared idea and have to find all five copies — which is exactly what adding
`faith` did.

**Fixed since this was written:** the day review existed twice and is now one
component behind both routes; the aggregated colours existed four times, one
copy silently missing `faith`; two category → bucket maps disagreed about
`other`; and `chart-colors.ts` carried its own 70/40 thresholds against the
rest of the app's 80/50. All now come from `lib/palette.ts` and
`lib/metrics-calc.ts`.

**Still outstanding:**

- `lib/types.ts` is 1,400 lines holding types, date maths, scoring helpers and
  category definitions. It is the de facto domain layer and should be split.
- 33 API routes import Supabase directly; there is no repository layer.
- 13 skipped day-review tests, parked behind commented-out sections.
- 64 lint errors, mostly React 19 compiler rules (`set-state-in-effect`,
  `purity`), non-blocking in CI by design.
- The Expo app queries Supabase directly, bypassing every guard and all the
  scoring logic. It is a second client with a second set of rules.

---

## 6. If I had a week

1. ~~Consolidate the day review into one implementation.~~ Done.
2. ~~Logging friction: same-as-yesterday, bulk ghost confirm.~~ Done.
   Templates and model-backed natural language deliberately left.
3. ~~One palette, one type scale, louder section headers, a desktop
   breakpoint.~~ Done, except that ~140 saturated colours remain in toasts,
   error states, banners, onboarding, settings and the guide page. Those are
   UI semantics rather than data, and were left deliberately.
4. ~~Rebuild Year in Pixels as a GitHub-style grid.~~ Done.
5. Promote the Library and link metrics to their research.

Items 1 and 2 are done. Whether the app gets used now depends on whether
one tap to repeat a day is enough — which only a few weeks of use will
say.
