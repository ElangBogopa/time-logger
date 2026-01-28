/**
 * Tests for Ghost Entry Filtering
 *
 * Expected behavior:
 * - Ghost entries (calendar events) should NOT appear when a confirmed entry
 *   covers the same time period
 * - When a ghost is confirmed, it should disappear from the timeline
 * - Ghosts should only show for calendar events that haven't been logged yet
 */

import { CalendarEvent } from '@/contexts/CalendarContext'
import { TimeEntry } from '@/lib/types'

// Helper function that mirrors the filtering logic we want to implement
function filterGhostsWithConfirmedEntries(
  calendarEvents: CalendarEvent[],
  entries: TimeEntry[],
  dismissedEventIds: Set<string>,
  showDismissed: boolean = false
): CalendarEvent[] {
  return calendarEvents.filter(event => {
    // Filter out dismissed events (unless showing dismissed)
    if (!showDismissed && dismissedEventIds.has(event.id)) return false

    // Filter out ghosts that have a confirmed entry covering the same time
    const eventStart = timeToMinutes(event.startTime)
    const eventEnd = timeToMinutes(event.endTime)

    const hasConfirmedOverlap = entries.some(entry => {
      if (!entry.start_time || !entry.end_time) return false
      if (entry.status !== 'confirmed') return false

      const entryStart = timeToMinutes(entry.start_time)
      const entryEnd = timeToMinutes(entry.end_time)

      // Check for significant overlap (>50% of ghost duration)
      const overlapStart = Math.max(eventStart, entryStart)
      const overlapEnd = Math.min(eventEnd, entryEnd)
      const overlapDuration = Math.max(0, overlapEnd - overlapStart)
      const ghostDuration = eventEnd - eventStart

      return overlapDuration >= ghostDuration * 0.5
    })

    // Hide ghost if it has a confirmed entry covering it
    return !hasConfirmedOverlap
  })
}

// Helper to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

describe('Ghost Entry Filtering', () => {
  const mockCalendarEvents: CalendarEvent[] = [
    {
      id: 'cal-1',
      title: 'Team Meeting',
      startTime: '09:00',
      endTime: '10:00',
      date: '2024-01-15',
      isAllDay: false,
    },
    {
      id: 'cal-2',
      title: 'Lunch',
      startTime: '12:00',
      endTime: '13:00',
      date: '2024-01-15',
      isAllDay: false,
    },
    {
      id: 'cal-3',
      title: 'Code Review',
      startTime: '14:00',
      endTime: '15:00',
      date: '2024-01-15',
      isAllDay: false,
    },
  ]

  describe('When no confirmed entries exist', () => {
    it('should show all ghost events', () => {
      const entries: TimeEntry[] = []
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      expect(result).toHaveLength(3)
      expect(result.map(e => e.id)).toEqual(['cal-1', 'cal-2', 'cal-3'])
    })
  })

  describe('When a confirmed entry covers the same time as a ghost', () => {
    it('should hide the ghost when entry exactly matches ghost time', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Team Meeting',
          category: 'meetings',
          duration_minutes: 60,
          start_time: '09:00',
          end_time: '10:00',
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T09:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      expect(result).toHaveLength(2)
      expect(result.map(e => e.id)).toEqual(['cal-2', 'cal-3'])
      expect(result.find(e => e.id === 'cal-1')).toBeUndefined()
    })

    it('should hide the ghost when entry covers more than 50% of ghost', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Meeting (adjusted)',
          category: 'meetings',
          duration_minutes: 45,
          start_time: '09:00',
          end_time: '09:45', // 45 min of 60 min ghost = 75%
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T09:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      expect(result).toHaveLength(2)
      expect(result.find(e => e.id === 'cal-1')).toBeUndefined()
    })

    it('should NOT hide the ghost when entry covers less than 50% of ghost', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Quick check',
          category: 'meetings',
          duration_minutes: 20,
          start_time: '09:00',
          end_time: '09:20', // 20 min of 60 min ghost = 33%
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T09:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      expect(result).toHaveLength(3)
      expect(result.find(e => e.id === 'cal-1')).toBeDefined()
    })
  })

  describe('When confirming a ghost entry', () => {
    it('should hide ghost after confirmation creates overlapping entry', () => {
      // Simulate: ghost at 12:00-13:00, user confirms and creates entry
      const entriesBeforeConfirm: TimeEntry[] = []
      const entriesAfterConfirm: TimeEntry[] = [
        {
          id: 'entry-lunch',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Lunch',
          category: 'meals',
          duration_minutes: 60,
          start_time: '12:00',
          end_time: '13:00',
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T12:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      // Before confirmation - ghost should show
      const beforeResult = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entriesBeforeConfirm,
        dismissedIds
      )
      expect(beforeResult.find(e => e.id === 'cal-2')).toBeDefined()

      // After confirmation - ghost should be hidden
      const afterResult = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entriesAfterConfirm,
        dismissedIds
      )
      expect(afterResult.find(e => e.id === 'cal-2')).toBeUndefined()
    })
  })

  describe('Pending entries should NOT hide ghosts', () => {
    it('should still show ghost when only pending entry exists', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Team Meeting',
          category: null, // pending entries have no category
          duration_minutes: 60,
          start_time: '09:00',
          end_time: '10:00',
          description: null,
          commentary: null,
          status: 'pending', // NOT confirmed
          created_at: '2024-01-15T09:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      // Ghost should still show because entry is pending, not confirmed
      expect(result).toHaveLength(3)
      expect(result.find(e => e.id === 'cal-1')).toBeDefined()
    })
  })

  describe('Dismissed events', () => {
    it('should respect dismissed events independently of confirmed entries', () => {
      const entries: TimeEntry[] = []
      const dismissedIds = new Set<string>(['cal-2'])

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      expect(result).toHaveLength(2)
      expect(result.find(e => e.id === 'cal-2')).toBeUndefined()
    })

    it('should show dismissed events when showDismissed is true', () => {
      const entries: TimeEntry[] = []
      const dismissedIds = new Set<string>(['cal-2'])

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds,
        true // showDismissed
      )

      expect(result).toHaveLength(3)
      expect(result.find(e => e.id === 'cal-2')).toBeDefined()
    })
  })

  describe('Multiple confirmed entries', () => {
    it('should hide multiple ghosts when multiple entries exist', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Team Meeting',
          category: 'meetings',
          duration_minutes: 60,
          start_time: '09:00',
          end_time: '10:00',
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T09:00:00Z',
        },
        {
          id: 'entry-2',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Code Review',
          category: 'deep_work',
          duration_minutes: 60,
          start_time: '14:00',
          end_time: '15:00',
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T14:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cal-2') // Only lunch ghost remains
    })
  })

  describe('Edge cases', () => {
    it('should handle entries without times', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Untimed task',
          category: 'admin',
          duration_minutes: 30,
          start_time: null,
          end_time: null,
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T09:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      // All ghosts should still show - untimed entry can't overlap
      expect(result).toHaveLength(3)
    })

    it('should handle adjacent but non-overlapping times', () => {
      const entries: TimeEntry[] = [
        {
          id: 'entry-1',
          user_id: 'user-1',
          date: '2024-01-15',
          activity: 'Before meeting',
          category: 'admin',
          duration_minutes: 60,
          start_time: '08:00',
          end_time: '09:00', // Ends exactly when ghost starts
          description: null,
          commentary: null,
          status: 'confirmed',
          created_at: '2024-01-15T08:00:00Z',
        },
      ]
      const dismissedIds = new Set<string>()

      const result = filterGhostsWithConfirmedEntries(
        mockCalendarEvents,
        entries,
        dismissedIds
      )

      // Ghost at 09:00-10:00 should still show - no overlap
      expect(result).toHaveLength(3)
      expect(result.find(e => e.id === 'cal-1')).toBeDefined()
    })
  })
})
