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
```typescript
type TimeCategory =
  | 'deep_work'    // Coding, writing, focused creative work
  | 'learning'     // Courses, studying, lectures (incl. university codes like "STA414H1")
  | 'meetings'     // Calls, syncs, 1:1s
  | 'admin'        // Email, scheduling, chores
  | 'exercise'     // Workouts, sports, walks
  | 'rest'         // Breaks, naps, relaxation
  | 'meals'        // Eating, cooking
  | 'self_care'    // Hygiene, meditation, health
  | 'relationships'// Social time, family, friends
  | 'distraction'  // Social media, aimless browsing
  | 'other'        // Fallback
```

## Common Pitfalls

### Timezone Handling
- Always use `getLocalDateString()` from `lib/types.ts` for dates
- API routes receive timezone param and convert appropriately
- Never use `new Date().toISOString().split('T')[0]` for user-facing dates

### AI API Calls
- **DO**: Call `/api/categorize` and `/api/commentary` only for confirmed entries
- **DON'T**: Categorize pending/future entries - wastes API calls
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
│   ├── TimeEntriesList.tsx   # List view of entries
│   ├── CalendarPicker.tsx    # Date navigation
│   └── ui/                   # shadcn components
├── contexts/
│   └── CalendarContext.tsx   # Calendar event caching
├── lib/
│   ├── types.ts              # TimeEntry, TimeCategory, helpers
│   ├── time-utils.ts         # Time formatting, calculations
│   ├── supabase.ts           # Supabase client
│   ├── auth.ts               # NextAuth options
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
2. **Muted palette**: Slate/zinc tones, no bright neons. Category colors are desaturated.
3. **Minimal UI**: shadcn/ui for consistency, no unnecessary chrome
4. **Progressive disclosure**: Quick log for speed, modal for details

## Quick Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build (catches type errors)
npm run lint     # ESLint
```

## Environment Variables

```
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```
