# TimelineView.tsx Refactoring Plan

## Overview

**Current State**: 2,189 lines of complex timeline rendering and interaction logic in a single component  
**Goal**: Split into focused, testable modules with clear separation of concerns  
**Target**: Reduce main TimelineView.tsx to ~200 lines as a slim orchestrator  

## 1. Module Breakdown

### Core Utilities & Constants
```
timeline/constants.ts
timeline/utils.ts
```

### Custom Hooks (Data & Interactions)
```
hooks/useTimelineData.ts
hooks/useTimelineMouseCreate.ts
hooks/useTimelineTouchCreate.ts
hooks/useEntryAdjustment.ts
hooks/useGhostEvents.ts
```

### UI Components
```
timeline/TimelineGrid.tsx
timeline/TimelineEntry.tsx
timeline/TimelineGap.tsx
timeline/TimelineGhost.tsx
timeline/DragPreview.tsx
timeline/CurrentTimeIndicator.tsx (already exists, just extract)
```

### Updated Main Component
```
TimelineView.tsx (slim orchestrator)
```

---

## 2. Detailed Module Specifications

### `timeline/constants.ts`
**Purpose**: All static constants, color mappings, and configuration  
**Exports**:
```typescript
export const PIXELS_PER_MINUTE = 1.5
export const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE // 90px per hour
export const MIN_BLOCK_HEIGHT = 24

// Interaction thresholds
export const DRAG_THRESHOLD = 20
export const SCROLL_CANCEL_THRESHOLD = 5
export const STILLNESS_CHECK_DELAY = 100
export const TOUCH_HOLD_DELAY = 400
export const GHOST_TAP_THRESHOLD = 150
export const ENTRY_EDGE_ZONE = 0.2
export const ENTRY_HOLD_DELAY = 200

// Color mappings
export const AGGREGATED_COLORS: Record<string, { border: string; bgLight: string; bgDark: string }>
export const CATEGORY_TO_AGGREGATED: Record<TimeCategory, string>
export const CATEGORY_COLORS: Record<TimeCategory, { bg: string; border: string; text: string }>
```

### `timeline/utils.ts`  
**Purpose**: Pure utility functions for timeline calculations  
**Exports**:
```typescript
export function getCategoryColors(category: TimeCategory): { bg: string; border: string; text: string }

export function findGaps(
  timedEntries: TimeEntry[], 
  startHour: number, 
  endHour: number
): { start: number; end: number }[]

export function smartPlaceEntries(
  timedEntries: TimeEntry[],
  untimedEntries: TimeEntry[],
  startHour: number,
  endHour: number
): PlacedEntry[]

export function yToTime(
  clientY: number,
  scrollContainer: HTMLElement | null,
  startHour: number
): string

export function detectEntryDragType(
  clientY: number,
  entryTop: number,
  entryHeight: number
): 'move' | 'resize-top' | 'resize-bottom'

export interface PlacedEntry extends TimeEntry {
  placedStartTime: string
  placedEndTime: string
  isEstimated: boolean
}

export interface TimeGap {
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
  durationMinutes: number
}
```

### `hooks/useTimelineData.ts`
**Purpose**: Data derivation and computed values  
**Interface**:
```typescript
export interface UseTimelineDataParams {
  entries: TimeEntry[]
  calendarEvents: CalendarEvent[]
  visibleStartHour?: number
  visibleEndHour?: number
  isToday?: boolean
  isFutureDay?: boolean
  selectedDate?: string
}

export interface UseTimelineDataReturn {
  // Processed data
  placedEntries: PlacedEntry[]
  ghostEvents: CalendarEvent[]
  timeGaps: TimeGap[]
  timedEntries: TimeEntry[]
  untimedEntries: TimeEntry[]
  
  // Calculated values
  totalMinutes: number
  timelineHeight: number
  hours: number[]
  startHour: number
  endHour: number
  
  // Overlap tracking
  overlappingEntryIds: Set<string>
  overlappingGhostIds: Set<string>
  
  // UI state
  isEmpty: boolean
}

export function useTimelineData(params: UseTimelineDataParams): UseTimelineDataReturn
```

### `hooks/useTimelineMouseCreate.ts`
**Purpose**: Mouse drag-to-create functionality  
**Interface**:
```typescript
export interface UseTimelineMouseCreateParams {
  enabled: boolean
  scrollContainerRef: RefObject<HTMLDivElement>
  startHour: number
  onDragCreate?: (data: DragCreateData) => void
}

export interface UseTimelineMouseCreateReturn {
  isDragging: boolean
  dragPreviewStart: string | null
  dragPreviewEnd: string | null
  handleMouseDown: (e: React.MouseEvent) => void
}

export function useTimelineMouseCreate(params: UseTimelineMouseCreateParams): UseTimelineMouseCreateReturn
```

### `hooks/useTimelineTouchCreate.ts`
**Purpose**: Touch hold-and-drag-to-create functionality  
**Interface**:
```typescript
export interface UseTimelineTouchCreateParams {
  enabled: boolean
  scrollContainerRef: RefObject<HTMLDivElement>
  startHour: number
  onDragCreate?: (data: DragCreateData) => void
}

export interface UseTimelineTouchCreateReturn {
  isTouchActive: boolean
  isTouchDragging: boolean
  touchDragPreviewStart: string | null
  touchDragPreviewEnd: string | null
  handleTouchStart: (e: React.TouchEvent) => void
}

export function useTimelineTouchCreate(params: UseTimelineTouchCreateParams): UseTimelineTouchCreateReturn
```

### `hooks/useEntryAdjustment.ts`
**Purpose**: Entry drag-to-resize/move functionality  
**Interface**:
```typescript
export interface UseEntryAdjustmentParams {
  enabled: boolean
  scrollContainerRef: RefObject<HTMLDivElement>
  startHour: number
  onEntryUpdate: (entryId: string, startTime: string, endTime: string) => void
  onEntryClick: (entry: PlacedEntry) => void
  onShowToast?: (message: string) => void
}

export interface UseEntryAdjustmentReturn {
  isEntryTouchActive: boolean
  isAdjustingEntry: boolean
  adjustPreview: { entryId: string; startTime: string; endTime: string } | null
  handleEntryMouseDown: (e: React.MouseEvent, entry: PlacedEntry) => void
  handleEntryTouchStart: (e: React.TouchEvent, entry: PlacedEntry) => void
}

export function useEntryAdjustment(params: UseEntryAdjustmentParams): UseEntryAdjustmentReturn
```

### `hooks/useGhostEvents.ts`
**Purpose**: Ghost event interactions and dismissal  
**Interface**:
```typescript
export interface UseGhostEventsParams {
  ghostEvents: CalendarEvent[]
  onGhostEntryClick?: (event: CalendarEvent) => void
  onDragCreate?: (data: DragCreateData) => void
  scrollContainerRef: RefObject<HTMLDivElement>
  startHour: number
}

export interface UseGhostEventsReturn {
  dismissedEventIds: Set<string>
  showDismissed: boolean
  setShowDismissed: (show: boolean) => void
  dismissGhostEvent: (eventId: string) => void
  restoreAllDismissed: () => void
  handleGhostMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void
  handleGhostTouchStart: (e: React.TouchEvent, event: CalendarEvent) => void
}

export function useGhostEvents(params: UseGhostEventsParams): UseGhostEventsReturn
```

### `timeline/TimelineGrid.tsx`
**Purpose**: Main timeline grid with hour lines and interaction area  
**Interface**:
```typescript
interface TimelineGridProps {
  timelineHeight: number
  hours: number[]
  startHour: number
  endHour: number
  isEmpty: boolean
  canLog: boolean
  isDragging: boolean
  isTouchDragging: boolean
  isAdjustingEntry: boolean
  onDragCreate?: (data: DragCreateData) => void
  onMouseDown: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  children: React.ReactNode
}

export default function TimelineGrid(props: TimelineGridProps): JSX.Element
```

### `timeline/TimelineEntry.tsx`
**Purpose**: Individual timeline entry rendering  
**Interface**:
```typescript
interface TimelineEntryProps {
  entry: PlacedEntry
  startHour: number
  adjustPreview: { entryId: string; startTime: string; endTime: string } | null
  overlappingEntryIds: Set<string>
  onMouseDown: (e: React.MouseEvent, entry: PlacedEntry) => void
  onTouchStart: (e: React.TouchEvent, entry: PlacedEntry) => void
  onClick?: (entry: PlacedEntry) => void
}

export default function TimelineEntry(props: TimelineEntryProps): JSX.Element
```

### `timeline/TimelineGap.tsx`
**Purpose**: Unlogged time gap indicators  
**Interface**:
```typescript
interface TimelineGapProps {
  gap: TimeGap
  startHour: number
  onDragCreate?: (data: DragCreateData) => void
}

export default function TimelineGap(props: TimelineGapProps): JSX.Element
```

### `timeline/TimelineGhost.tsx`
**Purpose**: Ghost calendar event rendering  
**Interface**:
```typescript
interface TimelineGhostProps {
  event: CalendarEvent
  startHour: number
  isDismissed: boolean
  isToday: boolean
  overlappingGhostIds: Set<string>
  onMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void
  onTouchStart: (e: React.TouchEvent, event: CalendarEvent) => void
  onDismiss: (eventId: string) => void
}

export default function TimelineGhost(props: TimelineGhostProps): JSX.Element
```

### `timeline/DragPreview.tsx`
**Purpose**: Drag creation preview overlay  
**Interface**:
```typescript
interface DragPreviewProps {
  startTime: string
  endTime: string
  startHour: number
  hasDraggedBeyondThreshold: boolean
}

interface DragPreviewData {
  top: number
  height: number
  previewStart: string
  previewEnd: string
  duration: number
}

export function calculateDragPreview(
  previewStart: string | null,
  previewEnd: string | null,
  startHour: number
): DragPreviewData | null

export default function DragPreview(props: DragPreviewProps): JSX.Element
```

### Updated `TimelineView.tsx`
**Purpose**: Slim orchestrator that wires everything together  
**Estimated Size**: ~200 lines  
**Key Responsibilities**:
- Props interface and validation
- Hook orchestration
- Modal state management
- High-level event handlers
- Final render composition

---

## 3. Dependency Map

### Foundation Layer (no dependencies)
- `timeline/constants.ts`
- `timeline/utils.ts` → imports constants
- `timeline/DragPreview.tsx` → imports utils, constants

### Hook Layer (depends on foundation)
- `hooks/useTimelineData.ts` → imports utils, constants, types
- `hooks/useTimelineMouseCreate.ts` → imports utils, constants
- `hooks/useTimelineTouchCreate.ts` → imports utils, constants
- `hooks/useEntryAdjustment.ts` → imports utils, constants
- `hooks/useGhostEvents.ts` → imports utils, constants

### Component Layer (depends on foundation + hooks)
- `timeline/TimelineGrid.tsx` → imports constants
- `timeline/TimelineEntry.tsx` → imports constants, utils
- `timeline/TimelineGap.tsx` → imports constants, utils
- `timeline/TimelineGhost.tsx` → imports constants, utils
- `timeline/CurrentTimeIndicator.tsx` → imports constants (extract from current file)

### Main Component (depends on all layers)
- `TimelineView.tsx` → imports all hooks, all components, utils

---

## 4. Implementation Order

### Phase 1: Foundation (Week 1)
1. `timeline/constants.ts` - Extract all constants
2. `timeline/utils.ts` - Extract pure utility functions
3. `timeline/DragPreview.tsx` - Simple stateless component

### Phase 2: Data Layer (Week 1-2)
4. `hooks/useTimelineData.ts` - Data derivation and computed values
5. `timeline/CurrentTimeIndicator.tsx` - Extract existing component

### Phase 3: Interaction Hooks (Week 2-3)
6. `hooks/useTimelineMouseCreate.ts` - Mouse drag-to-create
7. `hooks/useTimelineTouchCreate.ts` - Touch hold-and-drag
8. `hooks/useEntryAdjustment.ts` - Entry resize/move
9. `hooks/useGhostEvents.ts` - Ghost event interactions

### Phase 4: UI Components (Week 3-4)
10. `timeline/TimelineGrid.tsx` - Main grid layout
11. `timeline/TimelineEntry.tsx` - Individual entry rendering
12. `timeline/TimelineGap.tsx` - Gap indicators
13. `timeline/TimelineGhost.tsx` - Ghost event rendering

### Phase 5: Integration (Week 4)
14. Update `TimelineView.tsx` - Wire everything together
15. Remove old code - Clean up unused logic

---

## 5. Risk Assessment

### High Risk 🔴
- **Touch interaction sequence**: Complex state machine with multiple timers - test thoroughly on mobile
- **Entry adjustment precision**: Pixel-perfect drag calculations - verify edge cases
- **Event handler conflicts**: Multiple overlapping interaction handlers - ensure proper event stopping

### Medium Risk 🟡  
- **Ref management**: Many useRef values shared across hooks - ensure proper cleanup
- **Performance**: Multiple hooks and re-renders - monitor with React DevTools
- **State synchronization**: Complex state dependencies between hooks

### Low Risk 🟢
- **Static rendering**: Entry/ghost/gap components are mostly presentational
- **Utility functions**: Pure functions are easy to test and verify
- **Constants extraction**: Zero risk, purely organizational

### Testing Strategy
- **Unit tests**: All utility functions and individual hooks
- **Integration tests**: Hook combinations and state interactions  
- **Visual regression tests**: Component rendering under various states
- **Mobile testing**: Touch interaction flows on real devices
- **Performance testing**: Timeline with 50+ entries

---

## 6. Interface Contracts

### Core Types (Keep in main file or move to types.ts)
```typescript
export interface CalendarEvent {
  id: string
  title: string  
  startTime: string
  endTime: string
  date: string
  isAllDay: boolean
}

export interface DragCreateData {
  startTime: string
  endTime: string
}

export interface TimelineViewProps {
  entries: TimeEntry[]
  calendarEvents?: CalendarEvent[]
  isLoading: boolean
  onEntryDeleted: () => void
  onGhostEntryClick?: (event: CalendarEvent) => void
  onDragCreate?: (data: DragCreateData) => void
  onShowToast?: (message: string) => void
  selectedDate?: string
  isToday?: boolean
  isFutureDay?: boolean
  isPastDay?: boolean
  canLog?: boolean
  visibleStartHour?: number
  visibleEndHour?: number
}
```

### Hook Return Types
All hooks return objects with clearly defined interfaces (see individual hook specifications above).

### Event Handler Signatures
```typescript
type MouseEventHandler = (e: React.MouseEvent) => void
type TouchEventHandler = (e: React.TouchEvent) => void
type EntryEventHandler = (e: React.MouseEvent | React.TouchEvent, entry: PlacedEntry) => void
type GhostEventHandler = (e: React.MouseEvent | React.TouchEvent, event: CalendarEvent) => void
```

---

## 7. Migration Strategy

### Backward Compatibility
- Keep original `TimelineView.tsx` as `TimelineView.legacy.tsx` during development
- Use feature flags to switch between old/new implementations
- Maintain identical public API and prop interface

### Gradual Migration  
- Implement new modules alongside existing code
- Test each module independently before integration
- Replace functionality incrementally rather than big bang approach

### Validation
- Side-by-side testing of old vs new implementations
- Visual regression testing to ensure pixel-perfect consistency
- Performance benchmarking to ensure no degradation

### Rollback Plan
- Keep legacy implementation available for quick rollback
- Feature flag to disable new implementation if issues arise
- Monitoring and alerting for new bugs or performance issues

---

## 8. Success Metrics

### Code Quality
- ✅ Main component reduced from 2,189 to ~200 lines
- ✅ Each module under 300 lines with single responsibility
- ✅ 90%+ test coverage on all utility functions and hooks
- ✅ Zero ESLint/TypeScript errors

### Functionality 
- ✅ All existing features work identically
- ✅ Touch interactions work perfectly on mobile
- ✅ Entry adjustment precision maintained
- ✅ Performance matches or exceeds current implementation

### Maintainability
- ✅ New features can be added to focused modules
- ✅ Bug fixes require changes to single module
- ✅ Code is self-documenting with clear interfaces
- ✅ Easy onboarding for new developers

This refactoring will transform a monolithic 2,189-line component into a clean, modular architecture where each piece has a clear, focused responsibility. The result will be more maintainable, testable, and scalable code.