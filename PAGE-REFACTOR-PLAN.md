# Page.tsx Refactor Plan

## Overview
The main page component (399 lines) has multiple concerns mixed together. This plan extracts custom hooks, constants, and component boundaries to improve maintainability and testability.

## Current Hook Analysis

### useState Hooks (8 total)
- **Line 57:** `entries` - TimeEntry array for today's logged activities
- **Line 58:** `completions` - SessionCompletion array for session state tracking
- **Line 59:** `isLoading` - Loading state for data fetching
- **Line 60:** `showOnboarding` - Modal visibility for new user setup
- **Line 61:** `hasCheckedTargets` - Flag to prevent duplicate target checks
- **Line 62:** `yesterdayEveningLogged` - Whether yesterday's evening was logged
- **Line 64:** `currentHour` - Hydration-safe current hour (null initially)
- **Line 187:** `quotes` - Time period quotes object

### useEffect Hooks (6 total)
- **Lines 70-72:** Set current hour on client (hydration fix)
- **Lines 75-90:** Handle calendar connection URL redirects
- **Lines 93-97:** Authentication redirect logic
- **Lines 100-125:** Onboarding check (fetch user targets)
- **Lines 166-168:** Data fetching trigger
- **Lines 193-199:** Initialize quotes on client

### useCallback Hooks (1 total)
- **Lines 127-157:** `fetchData` - Main data fetching function

### useMemo Hooks (1 total)
- **Lines 171-173:** `sessionInfos` - Computed session states

## Proposed Custom Hooks

### 1. `useSessionData`
**Purpose:** Handle all data fetching and session management
**Lines to extract:** 57-59, 127-157, 166-168

```typescript
interface UseSessionDataReturn {
  entries: TimeEntry[]
  completions: SessionCompletion[]
  isLoading: boolean
  refetch: () => Promise<void>
}

function useSessionData(userId: string, today: string, currentHour: number | null): UseSessionDataReturn
```

**Extracted state:**
- `entries`, `setEntries`
- `completions`, `setCompletions` 
- `isLoading`, `setIsLoading`

**Extracted logic:**
- `fetchData` callback (lines 127-157)
- useEffect that calls fetchData (lines 166-168)
- Yesterday evening check logic (lines 148-154)

### 2. `useGreeting`
**Purpose:** Handle time-of-day greeting logic and quotes
**Lines to extract:** 187-199, plus utility function lines 33-48

```typescript
interface UseGreetingReturn {
  greeting: { text: string; emoji: string }
  quotes: Record<TimePeriod, string>
  currentPeriod: TimePeriod
}

function useGreeting(userName?: string, currentHour: number | null): UseGreetingReturn
```

**Extracted logic:**
- `getTimeOfDayGreeting` function (lines 33-48) - move to this hook
- quotes state and initialization (lines 187-199)
- currentPeriod calculation (line 67)

### 3. `useDashboardState` 
**Purpose:** UI state management and navigation
**Lines to extract:** 60-62, 64, 70-97, 100-125

```typescript
interface UseDashboardStateReturn {
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  currentHour: number | null
  yesterdayEveningLogged: boolean
  hasCheckedTargets: boolean
}

function useDashboardState(session: Session | null, status: string): UseDashboardStateReturn
```

**Extracted state:**
- `showOnboarding`, `setShowOnboarding`
- `hasCheckedTargets`, `setHasCheckedTargets`
- `yesterdayEveningLogged`, `setYesterdayEveningLogged`
- `currentHour`, `setCurrentHour`

**Extracted effects:**
- Current hour initialization (lines 70-72)
- Calendar redirect logic (lines 75-90)
- Auth redirect (lines 93-97)
- Onboarding check (lines 100-125)

## Proposed Component Extractions

### 1. `GreetingHeader`
**Lines to extract:** 298-304
```typescript
interface GreetingHeaderProps {
  greeting: { text: string; emoji: string }
  currentPeriod: TimePeriod
}
```

### 2. `HeroSection`
**Lines to extract:** 306-315
```typescript
interface HeroSectionProps {
  userId: string
}
```

### 3. `MotivationalQuote`
**Lines to extract:** 317-327
```typescript
interface MotivationalQuoteProps {
  quote: string
  currentPeriod: TimePeriod
}
```

### 4. `YesterdayEveningPrompt`
**Lines to extract:** 334-350
```typescript
interface YesterdayEveningPromptProps {
  onLogClick: () => void
}
```

### 5. `SessionCardsList`
**Lines to extract:** 357-368
```typescript
interface SessionCardsListProps {
  sessionInfos: SessionInfo[]
  quotes: Record<TimePeriod, string>
  onLogClick: (period: TimePeriod) => void
  onViewClick: (period: TimePeriod) => void
}
```

## Constants to Extract

### Magic Numbers
- **Line 35:** `12` - Default hour for server render → `DEFAULT_HOUR = 12`
- **Line 41:** `24` - Late night hour boundary → `LATE_NIGHT_BOUNDARY = 24`
- **Line 42, 44, 46:** `12, 18` - Time boundaries → `AFTERNOON_START = 12`, `EVENING_START = 18`

### Skeleton Loading
- **Line 227:** `[1, 2, 3, 4, 5]` → `MOOD_RATING_OPTIONS = 5`
- **Line 245:** `[0, 1, 2, 3]` → `SKELETON_SESSION_CARDS = 4`

### CSS Classes (consider moving to constants)
Common class combinations used repeatedly could be extracted to constants.

## TypeScript Interfaces

### For `useSessionData`
```typescript
interface SessionDataState {
  entries: TimeEntry[]
  completions: SessionCompletion[]
  isLoading: boolean
}

interface UseSessionDataProps {
  userId: string
  today: string
  currentHour: number | null
}
```

### For `useGreeting`
```typescript
interface GreetingData {
  text: string
  emoji: string
}

interface UseGreetingProps {
  userName?: string
  currentHour: number | null
}
```

### For `useDashboardState`
```typescript
interface DashboardUIState {
  showOnboarding: boolean
  currentHour: number | null
  yesterdayEveningLogged: boolean
  hasCheckedTargets: boolean
}

interface UseDashboardStateProps {
  session: Session | null
  status: string
}
```

## Implementation Order

1. **Constants extraction** (lowest risk)
   - Create `src/lib/constants.ts`
   - Extract all magic numbers

2. **Utility function extraction**
   - Move `getTimeOfDayGreeting` to `useGreeting` hook
   - Create `src/hooks/useGreeting.ts`

3. **State management hooks**
   - Create `src/hooks/useSessionData.ts`
   - Create `src/hooks/useDashboardState.ts`
   - Test each hook independently

4. **Component extractions** 
   - Start with pure components (GreetingHeader, MotivationalQuote)
   - Move to components with callbacks (SessionCardsList)

5. **Final integration**
   - Update main component to use new hooks and components
   - Remove unused imports and state

## File Structure After Refactor

```
src/
├── hooks/
│   ├── useSessionData.ts
│   ├── useGreeting.ts
│   └── useDashboardState.ts
├── components/
│   ├── dashboard/
│   │   ├── GreetingHeader.tsx
│   │   ├── HeroSection.tsx
│   │   ├── MotivationalQuote.tsx
│   │   ├── YesterdayEveningPrompt.tsx
│   │   └── SessionCardsList.tsx
├── lib/
│   └── constants.ts
└── app/
    └── page.tsx (significantly reduced)
```

## Benefits
1. **Separation of concerns** - Data fetching, UI state, and greeting logic isolated
2. **Testability** - Each hook can be unit tested independently
3. **Reusability** - Hooks can be used in other dashboard-like components
4. **Readability** - Main component focuses on layout and composition
5. **Maintainability** - Changes to data fetching don't affect UI state logic

## Estimated Effort
- **Constants:** 1-2 hours
- **Hooks:** 4-6 hours
- **Components:** 3-4 hours  
- **Integration & testing:** 2-3 hours
- **Total:** 10-15 hours

This refactor maintains the exact same functionality while improving code organization and maintainability.