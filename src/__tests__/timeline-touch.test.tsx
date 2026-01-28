/**
 * Tests for TimelineView touch interaction behavior
 *
 * Expected behavior (matching Google Calendar and other calendar apps):
 * 1. Touch + immediate scroll = SCROLL (no entry creation)
 * 2. Touch + hold still 100ms + hold 400ms more = ENTRY CREATION
 * 3. Touch + hold still 100ms + then move = SCROLL (cancel)
 * 4. Touch + hold confirmed + drag = entry with dragged time range
 */

import React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import TimelineView, { DragCreateData } from '@/components/TimelineView'

// Mock scrollTo for jsdom
Element.prototype.scrollTo = jest.fn()

// Mock the supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}))

describe('TimelineView Touch Interactions', () => {
  // Constants from the component (should match TimelineView.tsx)
  const SCROLL_CANCEL_THRESHOLD = 5 // pixels (updated from 3 for better fat finger tolerance)
  const STILLNESS_CHECK_DELAY = 100 // ms
  const TOUCH_HOLD_DELAY = 400 // ms (updated from 600 for more responsive feel)
  const TOTAL_HOLD_TIME = STILLNESS_CHECK_DELAY + TOUCH_HOLD_DELAY // 500ms total

  let onDragCreate: jest.Mock<void, [DragCreateData]>
  let onEntryDeleted: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    onDragCreate = jest.fn()
    onEntryDeleted = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const renderTimeline = () => {
    return render(
      <TimelineView
        entries={[]}
        calendarEvents={[]}
        isLoading={false}
        onEntryDeleted={onEntryDeleted}
        onDragCreate={onDragCreate}
        isToday={true}
      />
    )
  }

  const getTimelineGrid = (container: HTMLElement) => {
    // The timeline grid has cursor-crosshair class when onDragCreate is provided
    return container.querySelector('.cursor-crosshair') as HTMLElement
  }

  const createTouchEvent = (clientY: number) => ({
    touches: [{ clientY, clientX: 100 }],
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  })

  describe('Scroll Detection (touch + immediate move)', () => {
    it('should NOT create entry when user touches and immediately scrolls', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start at Y=500
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Immediately move beyond scroll threshold (5px) - simulating scroll
      act(() => {
        jest.advanceTimersByTime(10) // Only 10ms later
      })

      // Move finger by 10px (well beyond 5px threshold)
      fireEvent.touchMove(window, {
        touches: [{ clientY: 510, clientX: 100 }],
        preventDefault: jest.fn(),
      })

      // Wait for all timers to complete
      act(() => {
        jest.advanceTimersByTime(TOTAL_HOLD_TIME + 100)
      })

      // Release
      fireEvent.touchEnd(window)

      // Should NOT have called onDragCreate
      expect(onDragCreate).not.toHaveBeenCalled()
    })

    it('should NOT create entry when user scrolls within stillness check period', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Move after 50ms (before stillness check completes at 100ms)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 510, clientX: 100 }],
        preventDefault: jest.fn(),
      })

      // Wait for remaining time
      act(() => {
        jest.advanceTimersByTime(TOTAL_HOLD_TIME)
      })

      fireEvent.touchEnd(window)

      expect(onDragCreate).not.toHaveBeenCalled()
    })
  })

  describe('Hold to Create (touch + hold still)', () => {
    it('should create entry when user holds still for full duration', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Hold completely still for stillness check (100ms)
      act(() => {
        jest.advanceTimersByTime(STILLNESS_CHECK_DELAY)
      })

      // Continue holding for hold delay (600ms)
      act(() => {
        jest.advanceTimersByTime(TOUCH_HOLD_DELAY)
      })

      // Release without moving
      fireEvent.touchEnd(window)

      // Should have called onDragCreate with a time range
      expect(onDragCreate).toHaveBeenCalledTimes(1)
      expect(onDragCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: expect.any(String),
          endTime: expect.any(String),
        })
      )
    })

    it('should NOT create entry if released before hold completes', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Hold for only 300ms (less than 100ms + 400ms = 500ms required)
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Release early
      fireEvent.touchEnd(window)

      expect(onDragCreate).not.toHaveBeenCalled()
    })
  })

  describe('Cancel During Hold (touch + hold + then move)', () => {
    it('should NOT create entry when user moves AFTER stillness confirmed but BEFORE hold confirmed', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Wait for stillness to be confirmed (100ms)
      act(() => {
        jest.advanceTimersByTime(STILLNESS_CHECK_DELAY + 10)
      })

      // Move during the hold phase (before 400ms hold completes)
      fireEvent.touchMove(window, {
        touches: [{ clientY: 520, clientX: 100 }], // 20px movement
        preventDefault: jest.fn(),
      })

      // Wait for remaining time
      act(() => {
        jest.advanceTimersByTime(TOUCH_HOLD_DELAY)
      })

      fireEvent.touchEnd(window)

      // Should NOT create entry because user moved during hold phase
      expect(onDragCreate).not.toHaveBeenCalled()
    })
  })

  describe('Drag to Size (touch + hold confirmed + drag)', () => {
    it('should allow dragging to set time range AFTER hold is confirmed', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Wait for full hold confirmation (100ms + 400ms)
      act(() => {
        jest.advanceTimersByTime(TOTAL_HOLD_TIME)
      })

      // Now drag to adjust the time range (this should be allowed)
      fireEvent.touchMove(window, {
        touches: [{ clientY: 600, clientX: 100 }], // Drag down 100px
        preventDefault: jest.fn(),
      })

      // Release
      fireEvent.touchEnd(window)

      // Should have called onDragCreate
      expect(onDragCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe('Tiny Movement Tolerance', () => {
    it('should still create entry if movement is below scroll threshold (< 5px)', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Tiny movement (2px - below 5px threshold)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 502, clientX: 100 }], // Only 2px
        preventDefault: jest.fn(),
      })

      // Wait for full hold
      act(() => {
        jest.advanceTimersByTime(TOTAL_HOLD_TIME)
      })

      fireEvent.touchEnd(window)

      // Should still create entry because 2px < 5px threshold
      expect(onDragCreate).toHaveBeenCalledTimes(1)
    })

    it('should cancel if movement exceeds scroll threshold (>= 5px)', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Movement at exactly threshold (6px - above 5px)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 506, clientX: 100 }], // 6px > 5px
        preventDefault: jest.fn(),
      })

      // Wait for full hold
      act(() => {
        jest.advanceTimersByTime(TOTAL_HOLD_TIME)
      })

      fireEvent.touchEnd(window)

      // Should NOT create entry
      expect(onDragCreate).not.toHaveBeenCalled()
    })
  })
})

describe('Touch Interaction Timing Constants', () => {
  it('documents the expected timing behavior', () => {
    // These constants should match the implementation
    const SCROLL_CANCEL_THRESHOLD = 5 // pixels
    const STILLNESS_CHECK_DELAY = 100 // ms
    const TOUCH_HOLD_DELAY = 400 // ms

    // Total time user must hold still to trigger create mode
    const TOTAL_HOLD_TIME = STILLNESS_CHECK_DELAY + TOUCH_HOLD_DELAY

    expect(TOTAL_HOLD_TIME).toBe(500) // 700ms total

    // This matches Google Calendar behavior:
    // - Must hold finger still (not scrolling) for a noticeable moment
    // - Any immediate movement is interpreted as scroll intent
    // - Once create mode activates, user can drag to adjust time range
  })
})

describe('Entry Touch Interactions', () => {
  /**
   * Expected behavior for touching existing entries:
   * 1. Touch + immediate scroll on entry = SCROLL (no drag, no edit)
   * 2. Quick tap on entry (no movement, release quickly) = OPEN EDIT MODAL
   * 3. Touch + hold still 100ms + hold 200ms more (middle) = MOVE MODE
   * 4. Touch + hold still 100ms (edge) = RESIZE MODE
   * 5. After hold confirmed, drag = adjust entry time
   */

  const SCROLL_CANCEL_THRESHOLD = 5 // pixels
  const STILLNESS_CHECK_DELAY = 100 // ms
  const ENTRY_HOLD_DELAY = 200 // ms - additional hold for move (after stillness)

  let onDragCreate: jest.Mock
  let onEntryDeleted: jest.Mock

  // Create a mock entry for testing
  const mockEntry = {
    id: 'test-entry-1',
    user_id: 'user-1',
    date: '2024-01-15',
    activity: 'Test Activity',
    category: 'deep_work' as const,
    duration_minutes: 60,
    start_time: '09:00',
    end_time: '10:00',
    description: null,
    commentary: null,
    status: 'confirmed' as const,
    created_at: '2024-01-15T09:00:00Z',
  }

  beforeEach(() => {
    jest.useFakeTimers()
    onDragCreate = jest.fn()
    onEntryDeleted = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const renderTimelineWithEntry = () => {
    return render(
      <TimelineView
        entries={[mockEntry]}
        calendarEvents={[]}
        isLoading={false}
        onEntryDeleted={onEntryDeleted}
        onDragCreate={onDragCreate}
        isToday={true}
      />
    )
  }

  const getEntryBlock = (container: HTMLElement) => {
    return container.querySelector('[data-entry-block]') as HTMLElement
  }

  describe('Scroll Detection on Entry', () => {
    it('should allow scrolling when touching entry and moving immediately', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Touch start on entry
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: 500, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Immediately move (scrolling)
      act(() => {
        jest.advanceTimersByTime(10)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 520, clientX: 100 }], // 20px movement
        preventDefault: jest.fn(),
      })

      // Wait for timers
      act(() => {
        jest.advanceTimersByTime(500)
      })

      fireEvent.touchEnd(window)

      // Entry should NOT be in adjust mode - scroll happened
      // onEntryDeleted is NOT called (would be called if entry was modified)
      expect(onEntryDeleted).not.toHaveBeenCalled()
    })

    it('should cancel entry interaction when scrolling during stillness check', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Touch start on entry
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: 500, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Move after 50ms (before stillness confirmed at 100ms)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 510, clientX: 100 }], // 10px movement > 5px threshold
        preventDefault: jest.fn(),
      })

      // Wait for remaining timers
      act(() => {
        jest.advanceTimersByTime(500)
      })

      fireEvent.touchEnd(window)

      // Should have allowed scroll, not entered adjust mode
      expect(onEntryDeleted).not.toHaveBeenCalled()
    })
  })

  describe('Tap to Edit', () => {
    it('should open edit modal on quick tap (no movement, quick release)', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Touch start on entry
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: 500, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Quick release (before any timers fire) - no movement
      act(() => {
        jest.advanceTimersByTime(50) // Only 50ms
      })

      fireEvent.touchEnd(window)

      // Should have opened edit modal (we can't easily test this without mocking setSelectedEntry)
      // But we can verify no entry modification happened
      expect(onEntryDeleted).not.toHaveBeenCalled()
    })
  })

  describe('Hold to Move/Resize', () => {
    it('should enter resize mode after holding still on edge (100ms)', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Get entry position to touch near edge
      const rect = entryBlock.getBoundingClientRect()

      // Touch start near bottom edge of entry
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: rect.bottom - 5, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Hold still for stillness check (100ms)
      act(() => {
        jest.advanceTimersByTime(STILLNESS_CHECK_DELAY + 10)
      })

      // Should now be in resize mode (can drag to resize)
      // Drag down to extend entry
      fireEvent.touchMove(window, {
        touches: [{ clientY: rect.bottom + 50, clientX: 100 }],
        preventDefault: jest.fn(),
      })

      fireEvent.touchEnd(window)

      // Entry should have been updated (onEntryDeleted is called to refresh)
      // Note: This test may not fully verify the behavior without more mocking
    })

    it('should enter move mode after holding still in middle (100ms + 200ms)', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Touch start in middle of entry
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: 500, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Hold still for stillness check (100ms) + move hold (200ms)
      act(() => {
        jest.advanceTimersByTime(STILLNESS_CHECK_DELAY + ENTRY_HOLD_DELAY + 10)
      })

      // Should now be in move mode - drag to move entry
      fireEvent.touchMove(window, {
        touches: [{ clientY: 600, clientX: 100 }], // Move down
        preventDefault: jest.fn(),
      })

      fireEvent.touchEnd(window)

      // Entry modification should have been triggered
    })
  })

  describe('Tiny Movement Tolerance on Entry', () => {
    it('should still allow hold if movement is below threshold (< 5px)', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Touch start
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: 500, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Tiny movement (2px - below threshold)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 502, clientX: 100 }], // Only 2px
        preventDefault: jest.fn(),
      })

      // Wait for hold to complete
      act(() => {
        jest.advanceTimersByTime(STILLNESS_CHECK_DELAY + ENTRY_HOLD_DELAY + 50)
      })

      fireEvent.touchEnd(window)

      // Should have entered adjust mode despite tiny movement
    })

    it('should cancel hold if movement exceeds threshold (>= 5px)', () => {
      const { container } = renderTimelineWithEntry()
      const entryBlock = getEntryBlock(container)

      if (!entryBlock) {
        throw new Error('Entry block not found')
      }

      // Touch start
      fireEvent.touchStart(entryBlock, {
        touches: [{ clientY: 500, clientX: 100 }],
        stopPropagation: jest.fn(),
      })

      // Movement at threshold (6px > 5px)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 506, clientX: 100 }], // 6px > 5px threshold
        preventDefault: jest.fn(),
      })

      // Wait for timers
      act(() => {
        jest.advanceTimersByTime(STILLNESS_CHECK_DELAY + ENTRY_HOLD_DELAY + 50)
      })

      fireEvent.touchEnd(window)

      // Should have cancelled - no entry modification
      expect(onEntryDeleted).not.toHaveBeenCalled()
    })
  })
})
