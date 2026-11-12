# CLAUDE.md - Time Logger Project Guide

## Project Overview

Time tracking app with AI-powered activity categorization. Users log activities manually or import from Google Calendar. AI categorizes and provides witty commentary on confirmed entries only.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js with Google OAuth (calendar scope)
- **AI**: OpenAI GPT-4o-mini for categorization + commentary
- **UI**: shadcn/ui components + Tailwind CSS
- **State**: React Context (CalendarContext for caching)

## Key Concepts

### Entry States

```
PENDING (status: 'pending')
├── Future planned entries - user scheduled ahead of time
├── Ghost entries from calendar - not yet confirmed
└── No AI categorization yet, category is null

CONFIRMED (status: 'confirmed')
├── Past/present entries user has verified
├── AI categorization applied
└── AI commentary generated
```

### Ghost Entries
Calendar events shown as dashed blue blocks. Not stored in DB until user confirms. Click to convert to real entry.

### Categories (Supabase enum must match exactly)
19 categories, grouped. The source of truth is `TimeCategory` in `lib/types.ts`.

```typescript
type TimeCategory =
  // PRODUCTIVE
  | 'deep_work'       // Focused cognitively demanding work
  | 'shallow_work'    // Quick tasks, admin within work context
  | 'meetings'        // Synchronous work communication
  | 'learning'        // Courses, studying, reading
  | 'creating'        // Creative hobbies, side projects
  // MAINTENANCE
  | 'admin'           // Personal admin (email, finances, planning)
  | 'errands'         // Outside home (shopping, appointments)
  | 'chores'          // Inside home (cleaning, cooking, repairs)
  | 'commute'         // Travel to/from obligations
  // BODY
  | 'exercise'        // Intentional workout
  | 'movement'        // Light activity (walks, stretching)
  | 'meals'           // Eating, food prep
  | 'sleep'           // Sleep tracking
  // MIND
  | 'rest'            // Intentional downtime, naps
  | 'self_care'       // Hygiene, meditation, health
  // CONNECTION
  | 'social'          // Friends, family, community
  | 'calls'           // Personal calls/video chats
  // LEISURE
  | 'entertainment'   // TV, games, movies, browsing
  // FALLBACK
  | 'other'           // Anything that doesn't fit
```

For display, these roll up into six `AggregatedCategory` buckets —
`focus | ops | body | recovery | connection | escape` (see `ENERGY_VIEW`).

## Common Pitfalls

### Timezone Handling
- Always use `getLocalDateString()` from `lib/types.ts` for dates
- API routes receive timezone param and convert appropriately
- Never use `new Date().toISOString().split('T')[0]` for user-facing dates

### AI API Calls
- **DO**: Call `/api/categorize` and `/api/commentary` only for confirmed entries
- **DON'T**: Categorize pending/future entries - wastes API calls
- **DO**: Use the batch forms when acting on a set — `/api/categorize` takes
  `{ activities: string[] }` and answers in one model call, `/api/entries`
  takes `{ entries: [...] }` and inserts in one statement. Confirming four
  calendar events one at a time was four prompts and four inserts.
- **DON'T**: Generate per-entry commentary for a bulk action
- Pending entries use static `PENDING_COMMENTARY.planned` message

### Timeline Component
- Must always show full 24 hours (0-24) with `h-[500px] overflow-y-scroll`
- Touch drag-to-create: 150ms hold delay to distinguish from scroll
- Current time indicator only shown on today

### Calendar API Caching
- CalendarContext caches events for ±7/14 days from today
- 30-minute cache duration
- Don't fetch calendar for each date change

## File Structure

```
src/
├── app/
│   ├── page.tsx              # Main dashboard (date picker, timeline, entries)
│   ├── login/page.tsx        # Login screen
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth config
│       ├── calendar/events/   # Google Calendar fetch (supports date ranges)
│       ├── categorize/        # AI category classification
│       └── commentary/        # AI witty remarks
├── components/
│   ├── TimelineView.tsx      # 24hr timeline with drag-to-create
│   ├── QuickLogModal.tsx     # Fast entry creation modal
│   ├── TimeEntryModal.tsx    # Edit/view entry details
│   ├── CalendarPicker.tsx    # Date navigation
│   ├── timeline/             # Timeline internals (grid, entry, ghost, gap)
│   ├── charts/               # Recharts wrappers + shared chart config
│   ├── review/               # Day/weekly review tab content
│   └── ui/                   # shadcn components
├── contexts/
│   └── CalendarContext.tsx   # Calendar event caching
├── hooks/                    # Data fetching + timeline interaction hooks
├── lib/
│   ├── types.ts              # TimeEntry, TimeCategory, date + domain helpers
│   ├── palette.ts            # Every data colour, defined once
│   ├── time-utils.ts         # Time formatting, calculations
│   ├── supabase-server.ts    # Supabase client (server-side; the only one)
│   ├── auth.ts               # NextAuth options
│   ├── api.ts                # Client-side fetch wrappers (csrfFetch)
│   └── rate-limit.ts         # API rate limiting
└── supabase/
    └── migrations/           # DB schema changes
```

## Database Schema

```sql
time_entries (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  date date NOT NULL,
  activity text NOT NULL,
  category time_category,        -- NULL for pending
  duration_minutes int NOT NULL,
  start_time time,
  end_time time,
  description text,
  commentary text,
  status text DEFAULT 'confirmed', -- 'pending' | 'confirmed'
  created_at timestamptz
)
```

## What the app is for

Google Calendar holds commitments with other people, at times other people
chose. Everything else — deep work, the gym, the call home — has no owner
and no time, which is most of why it does not happen. Better fits those
around the fixed things and says why it chose each hour, then records what
actually happened. It never writes to Google: the sync is read-only by
design.

The four tabs are Today (capture), Review (what happened), Plan (what is
next) and More. They are one loop — plan, do, record, review, plan again —
and each hands off to the next: Today leads with *Next up*, the day's plan
and calendar with a line for now; Review opens on the last finished day,
yesterday until 9pm; and both reviews end by pointing at the planner. The research lives in More and is cited from the places it
explains — every scheduling suggestion carries the library entry that
backs it.

A new account gets four screens (`OnboardingModal`): a name, what the app
is for — argued from the person's own calendar — the three scores, and a
first plan, which hands straight to the planner with the proposal already
made (`/calendar?date=…&suggest=1`). After that Today shows a three-step
"Getting started" list (`FirstRunCard`, state in `lib/first-run.ts`) until
the loop has been walked once. `productivity_target` in preferences is no
longer a setting: nothing reads the number, and it survives only as the
flag that says an account has been onboarded.

## Design Principles

1. **Mobile only**: Touch targets 44px+, hold-to-drag. The whole app renders
   in a 430px column (`.app-frame` in globals.css) on every screen size, so a
   browser window shows exactly what the phone shows. The frame carries a
   transform, which makes it the containing block for `position: fixed`, so
   the bottom bar, the floating button and the modals stay inside the column
   — and the scrolling lives one level in, on `.app-scroll`, because a
   scrolling containing block drags its fixed children up the screen.
2. **Muted palette**: Slate/zinc tones, no bright neons. Colour has exactly
   three jobs, and anything else is neutral (`text-muted-foreground`,
   `bg-secondary`): it encodes data, it signals good/warning/bad, or it is
   not colour. Decoration — a settings row's icon in its own hue — is the
   habit that made the app look busy. Tailwind's saturated scales are banned
   outright and `palette-discipline.test.ts` fails if one reappears. Every colour the app
   paints data with — categories, the three hero rings, status, score bars —
   comes from `lib/palette.ts`. Each hero metric takes the colour of the
   bucket it is computed from (Body→body, Mind→focus, Heart→connection), so a
   ring matches the timeline blocks that filled it. The Tailwind classes there
   are written out as literals on purpose: Tailwind v4 scans source text, so
   `bg-[${hex}]` built at runtime emits no CSS. `palette.test.ts` checks the
   literals against the hexes and rejects anything as saturated as a Tailwind
   500.
3. **Minimal UI**: shadcn/ui for consistency, no unnecessary chrome. Group
   with space and dividers before reaching for another border: a list is
   one card with `divide-y`, not a card of cards, and an icon is an icon,
   not an icon in a tinted circle. One primary button (the default `Button`
   variant, 44px tall) per decision. Everything modal is a sheet from the
   bottom edge — `DialogContent` is one, lifted clear of the keyboard by
   `--keyboard-inset` — and toasts appear at the top, because the bottom
   belongs to the tab bar, the add button and the sheets. One ring
   component (`MetricRing`): a ring on target gets a brighter stroke, a
   halo and a tick, and ripples once as it crosses.
4. **Progressive disclosure**: Quick log for speed, modal for details
5. **One type scale**: `eyebrow` (section headings — sentence case, 15px
   semibold; they were small capitals, five to a screen), `field-label`
   (the one small-capitals register, for a label above its value),
   `metric-number` and `ring-number` (figures, set in Barlow Semi Condensed
   via `--font-figures`) and `page-title`, all defined as Tailwind utilities
   in `globals.css`. Nothing a person has to read is under 12px, and
   secondary text is `text-muted-foreground` at full strength — not dimmed
   further with an opacity suffix.
6. **Body needs exercise**: upkeep earns its way up a curve that approaches
   69 and never reaches it; exercise closes the gap from there to 99.
   `body = upkeep + (99 − upkeep) × curve(exercise)`. So a flawless day of
   looking after yourself scores about 66 — a good day — and no amount of
   sleep, food or self-care reaches 70, because the app should not tell you
   your body had a strong day when you did not move it. Exercise is counted
   in moderate-equivalent minutes: vigorous double, light half, as the WHO
   guidelines count them, with the intensity read from the activity text by
   `classifyIntensity`. `UPKEEP_CEILING` is where you move the line.
7. **One scoring system**: Body / Mind / Heart, from `lib/metrics-calc.ts`,
   on a saturating curve where the target scores 80 and 100 is unreachable.
   Anywhere that wants "a number for this day or week" shows those three
   (`components/MetricRings.tsx`), never a new formula. Four had grown — the
   day review scored sessions logged ÷ sessions passed, the weekly review
   scored active days plus entries per day, the session popup had a third
   and the year grid a fourth. All measured how diligently you logged, all
   on the same 0–100 dial, and all hit 100 for showing up. Where only one
   value fits, as in the year grid, use `countMetricsOnTarget` — how many of
   the three reached their target — rather than averaging them or inventing
   a scale.
8. **No loading flash on navigation**: Every component that fetches data MUST cache its state in `sessionStorage`. On re-mount, load from cache instantly (no spinner), then refresh data silently in the background. Pattern:
   ```typescript
   // Load from cache — no spinner if cached
   const cached = (() => {
     if (typeof window === 'undefined') return null
     try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '') } catch { return null }
   })()
   const [data, setData] = useState(cached?.data || defaultValue)
   const [isLoading, setIsLoading] = useState(!cached)
   
   // After fetch, save to cache
   sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: newData }))
   ```
   This prevents the "spinner flash" when navigating back to previously-visited pages.
9. **Time-aware labels**: Never show negative/judging labels (e.g. "Tough day") when the user hasn't had a chance to act yet. Score labels must account for the current time of day.
10. **Plan, then do — and the two must meet**: Planning happens on the Plan
    tab and the goal page, which stay free of checkboxes. A plan is settled
    where the day is lived: the *Next up* list (`components/NextUp.tsx`,
    logic in `lib/next-up.ts`) on Today and in each session. *Did it* writes
    the entry at the planned time and marks the plan kept, tagged with the
    session its time falls in; *Move* reschedules it; *Skip* sets it aside
    on this device and leaves the plan untouched, so the review still
    reports it as not done. A plan the log already shows needs no tick at
    all — `comparePlanToActual` recognises it. This replaced "completion
    ONLY from the post-session popup", which kept the invariant that every
    completion carries its session but made the plan invisible everywhere
    except a popup people skip. The popup can still tick tasks.
11. **Your habit outranks the textbook**: The planner reads the last four
    weeks of the log (`lib/habits.ts`) for your usual hour and length for a
    thing, when you get up, and what you do often. `suggestTimes` proposes
    your usual hour first and quotes the research only where it agrees; with
    no habit it falls back to `IDEAL_DAY`. A habit needs three separate
    days, and an hour that wanders more than 90 minutes is not a usual hour.
    Nothing is proposed before half an hour after you usually wake. Plans
    are stored without a category, so the categoriser's answer is kept per
    session (`plan-task-categories`) — it is what colours a proposal and
    lets "If the day goes to plan" score it with the ordinary `calcBody` /
    `calcFocus` / `calcSocial`, never a new formula.

## Quick Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build (catches type errors)
npm run lint     # ESLint
npm test         # Jest suite
npm run test:tz  # Date helpers across 7 timezones (UTC+14 … UTC-11)
```

Dates: never round-trip a local date through `toISOString()`. Use
`getLocalDateString`, `shiftDateString` and `getWeekStartForDate` from
`lib/types.ts` — a UTC round-trip shifts the day east of UTC, and in the
evening west of it. `npm run test:tz` guards this.

## Environment Variables

See `.env.example` for the full list with notes. Summary:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=        NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# NextAuth + Google OAuth (calendar + tasks scopes)
NEXTAUTH_SECRET=                 NEXTAUTH_URL=
GOOGLE_CLIENT_ID=                GOOGLE_CLIENT_SECRET=
# AI
OPENAI_API_KEY=
# Email (Resend)
EMAIL_FROM=                      RESEND_API_KEY=
# Web push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    VAPID_PRIVATE_KEY=    VAPID_EMAIL=
# Cron
CRON_SECRET=
# Sentry
NEXT_PUBLIC_SENTRY_DSN=          SENTRY_ORG=    SENTRY_PROJECT=    SENTRY_AUTH_TOKEN=
```

Only `NEXT_PUBLIC_*` values reach the browser; `OPENAI_API_KEY` and the other
secrets are server-only. Every route that calls OpenAI checks the session
first and rate-limits by user ID.
