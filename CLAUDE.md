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

## Design Principles

1. **Mobile-first**: Touch targets 44px+, hold-to-drag, responsive layouts
2. **Muted palette**: Slate/zinc tones, no bright neons. Every colour the app
   paints data with — categories, the three hero rings, status, score bars —
   comes from `lib/palette.ts`. Each hero metric takes the colour of the
   bucket it is computed from (Body→body, Mind→focus, Heart→connection), so a
   ring matches the timeline blocks that filled it. The Tailwind classes there
   are written out as literals on purpose: Tailwind v4 scans source text, so
   `bg-[${hex}]` built at runtime emits no CSS. `palette.test.ts` checks the
   literals against the hexes and rejects anything as saturated as a Tailwind
   500.
3. **Minimal UI**: shadcn/ui for consistency, no unnecessary chrome
4. **Progressive disclosure**: Quick log for speed, modal for details
5. **One type scale**: `eyebrow` (section labels), `field-label` (quieter
   labels inside modals), `metric-number` and `page-title`, all defined as
   Tailwind utilities in `globals.css`. Reach for one of those before writing
   another `text-[11px] uppercase tracking-wider`.
6. **No loading flash on navigation**: Every component that fetches data MUST cache its state in `sessionStorage`. On re-mount, load from cache instantly (no spinner), then refresh data silently in the background. Pattern:
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
7. **Time-aware labels**: Never show negative/judging labels (e.g. "Tough day") when the user hasn't had a chance to act yet. Score labels must account for the current time of day.
8. **Planning vs Execution separation**: The goal/productivity page is for PLANNING only (no interactive checkboxes). Task completion ONLY happens from session pages (post-session popup) where each completion is tagged with the session period (morning/afternoon/evening).

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
