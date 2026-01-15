/**
 * Tests for TimelineView touch interaction behavior
 *
 * Expected behavior (matching Google Calendar and other calendar apps):
 * 1. Touch + immediate scroll = SCROLL (no entry creation)
 * 2. Touch + hold still 100ms + hold 600ms more = ENTRY CREATION
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
  const SCROLL_CANCEL_THRESHOLD = 3 // pixels
  const STILLNESS_CHECK_DELAY = 100 // ms
  const TOUCH_HOLD_DELAY = 600 // ms
  const TOTAL_HOLD_TIME = STILLNESS_CHECK_DELAY + TOUCH_HOLD_DELAY // 700ms total

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

      // Immediately move beyond scroll threshold (3px) - simulating scroll
      act(() => {
        jest.advanceTimersByTime(10) // Only 10ms later
      })

      // Move finger by 10px (well beyond 3px threshold)
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

      // Hold for only 300ms (less than 100ms + 600ms = 700ms required)
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

      // Move during the hold phase (before 600ms hold completes)
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

      // Wait for full hold confirmation (100ms + 600ms)
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
    it('should still create entry if movement is below scroll threshold (< 3px)', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Tiny movement (2px - below 3px threshold)
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

      // Should still create entry because 2px < 3px threshold
      expect(onDragCreate).toHaveBeenCalledTimes(1)
    })

    it('should cancel if movement exceeds scroll threshold (>= 3px)', () => {
      const { container } = renderTimeline()
      const grid = getTimelineGrid(container)

      if (!grid) {
        throw new Error('Timeline grid not found')
      }

      // Touch start
      fireEvent.touchStart(grid, createTouchEvent(500))

      // Movement at exactly threshold (4px - above 3px)
      act(() => {
        jest.advanceTimersByTime(50)
      })

      fireEvent.touchMove(window, {
        touches: [{ clientY: 504, clientX: 100 }], // 4px > 3px
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
    const SCROLL_CANCEL_THRESHOLD = 3 // pixels
    const STILLNESS_CHECK_DELAY = 100 // ms
    const TOUCH_HOLD_DELAY = 600 // ms

    // Total time user must hold still to trigger create mode
    const TOTAL_HOLD_TIME = STILLNESS_CHECK_DELAY + TOUCH_HOLD_DELAY

    expect(TOTAL_HOLD_TIME).toBe(700) // 700ms total

    // This matches Google Calendar behavior:
    // - Must hold finger still (not scrolling) for a noticeable moment
    // - Any immediate movement is interpreted as scroll intent
    // - Once create mode activates, user can drag to adjust time range
  })
})
