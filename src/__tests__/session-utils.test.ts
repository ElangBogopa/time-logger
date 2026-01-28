import { findFirstGapInPeriod } from '@/lib/session-utils'
import { TimeEntry } from '@/lib/types'

// Helper to create a mock TimeEntry
function createEntry(startTime: string, endTime: string): TimeEntry {
  return {
    id: Math.random().toString(),
    user_id: 'test-user',
    date: '2024-01-15',
    activity: 'Test activity',
    category: 'deep_work',
    duration_minutes: 60,
    start_time: startTime,
    end_time: endTime,
    description: null,
    commentary: null,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  }
}

describe('findFirstGapInPeriod', () => {
  // ACTUAL Period ranges from types.ts:
  // morning: 0-12 (midnight to noon, 0-720 mins)
  // afternoon: 12-18 (noon to 6pm, 720-1080 mins)
  // evening: 18-24 (6pm to midnight, 1080-1440 mins)

  describe('basic gap finding', () => {
    it('returns full period start when no entries exist', () => {
      const result = findFirstGapInPeriod([], 'morning', 60)
      // Morning starts at 0:00 (midnight)
      expect(result).toEqual({ startTime: '00:00', endTime: '01:00' })
    })

    it('returns gap after first entry when first entry starts later than period', () => {
      const entries = [createEntry('08:00', '09:00')]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Starts searching from first entry (08:00), so gap is after it: 09:00-10:00
      expect(result).toEqual({ startTime: '09:00', endTime: '10:00' })
    })

    it('returns gap after single entry when entry starts at period start', () => {
      const entries = [createEntry('00:00', '01:00')]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '01:00', endTime: '02:00' })
    })

    it('finds gap between two entries', () => {
      const entries = [
        createEntry('00:00', '01:00'),
        createEntry('03:00', '04:00'),
      ]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '01:00', endTime: '02:00' })
    })
  })

  describe('max duration cap', () => {
    it('caps gap duration at maxDurationMins', () => {
      const entries: TimeEntry[] = []
      const result = findFirstGapInPeriod(entries, 'morning', 30) // 30 min cap
      expect(result).toEqual({ startTime: '00:00', endTime: '00:30' })
    })

    it('returns smaller gap when gap is smaller than max', () => {
      const entries = [
        createEntry('00:00', '00:30'),
        createEntry('01:00', '02:00'),
      ]
      // Gap is 00:30-01:00 (30 mins), max is 60
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '00:30', endTime: '01:00' })
    })
  })

  describe('entries crossing period boundaries', () => {
    it('handles entry that starts in period but ends after period', () => {
      // Morning is 0-12, entry 11-13 crosses into afternoon
      const entries = [createEntry('11:00', '13:00')]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Starts from first entry (11:00), entry clamped to end at 12:00, no gap after
      expect(result).toBeNull()
    })

    it('handles entry that starts before period and ends in period', () => {
      // Afternoon is 12-18, entry 10-14 starts before
      const entries = [createEntry('10:00', '14:00')]
      const result = findFirstGapInPeriod(entries, 'afternoon', 60)
      // Entry is clamped to start at 12:00, so gap is after 14:00
      expect(result).toEqual({ startTime: '14:00', endTime: '15:00' })
    })

    it('handles entry that completely spans the period', () => {
      // Afternoon is 12-18, entry 10-20 completely covers it
      const entries = [createEntry('10:00', '20:00')]
      const result = findFirstGapInPeriod(entries, 'afternoon', 60)
      // No gap available
      expect(result).toBeNull()
    })

    it('ignores entries completely outside the period', () => {
      // Afternoon is 12-18, entry 08-10 is in morning
      const entries = [createEntry('08:00', '10:00')]
      const result = findFirstGapInPeriod(entries, 'afternoon', 60)
      // Entry doesn't affect afternoon, full gap available
      expect(result).toEqual({ startTime: '12:00', endTime: '13:00' })
    })
  })

  describe('current time constraints', () => {
    it('limits gap to current time when within period', () => {
      const entries: TimeEntry[] = []
      // Morning 0-12, current time is 2:30 (150 mins)
      const result = findFirstGapInPeriod(entries, 'morning', 60, 150)
      expect(result).toEqual({ startTime: '00:00', endTime: '01:00' })
    })

    it('returns null when current time is before period', () => {
      const entries: TimeEntry[] = []
      // Afternoon 12-18, current time is 10:00 (600 mins)
      const result = findFirstGapInPeriod(entries, 'afternoon', 60, 600)
      expect(result).toBeNull()
    })

    it('uses full period when current time is after period', () => {
      const entries: TimeEntry[] = []
      // Morning 0-12, current time is 14:00 (840 mins) - afternoon
      const result = findFirstGapInPeriod(entries, 'morning', 60, 840)
      expect(result).toEqual({ startTime: '00:00', endTime: '01:00' })
    })

    it('limits available gap when current time cuts into potential gap', () => {
      const entries = [createEntry('12:00', '13:00')]
      // Afternoon 12-18, current time is 13:20 (800 mins), so only 20 mins gap available
      const result = findFirstGapInPeriod(entries, 'afternoon', 60, 800)
      expect(result).toEqual({ startTime: '13:00', endTime: '13:20' })
    })

    it('returns null when period is fully covered up to current time', () => {
      const entries = [createEntry('12:00', '14:00')]
      // Afternoon 12-18, current time is 14:00 (840 mins), no gap available
      const result = findFirstGapInPeriod(entries, 'afternoon', 60, 840)
      expect(result).toBeNull()
    })
  })

  describe('multiple entries with gaps', () => {
    it('finds first gap when multiple gaps exist', () => {
      const entries = [
        createEntry('00:30', '01:00'),
        createEntry('02:00', '03:00'),
        createEntry('04:00', '05:00'),
      ]
      // Starts from first entry (00:30), first gap is 01:00-02:00
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '01:00', endTime: '02:00' })
    })

    it('returns small gap when first gap is small', () => {
      const entries = [
        createEntry('00:00', '01:00'),
        createEntry('01:10', '02:00'), // 10 min gap
        createEntry('03:00', '04:00'), // 1 hour gap before this
      ]
      // First gap is 01:00-01:10 (10 mins)
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '01:00', endTime: '01:10' })
    })

    it('handles overlapping entries correctly', () => {
      const entries = [
        createEntry('00:00', '02:00'),
        createEntry('01:00', '03:00'), // Overlaps with first
      ]
      // Combined coverage is 00:00-03:00
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '03:00', endTime: '04:00' })
    })

    it('handles entries in non-chronological order', () => {
      const entries = [
        createEntry('03:00', '04:00'),
        createEntry('00:00', '01:00'),
        createEntry('01:30', '02:00'),
      ]
      // First gap should be 01:00-01:30
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '01:00', endTime: '01:30' })
    })
  })

  describe('different periods', () => {
    it('works for afternoon period (12-18)', () => {
      const entries = [createEntry('13:00', '14:00')]
      const result = findFirstGapInPeriod(entries, 'afternoon', 60)
      // Starts from first entry (13:00), gap after is 14:00-15:00
      expect(result).toEqual({ startTime: '14:00', endTime: '15:00' })
    })

    it('works for evening period (18-24)', () => {
      const entries = [createEntry('19:00', '20:00')]
      const result = findFirstGapInPeriod(entries, 'evening', 60)
      // Starts from first entry (19:00), gap after is 20:00-21:00
      expect(result).toEqual({ startTime: '20:00', endTime: '21:00' })
    })

    it('handles evening entries correctly up to midnight', () => {
      const entries = [createEntry('18:00', '23:00')]
      const result = findFirstGapInPeriod(entries, 'evening', 60)
      expect(result).toEqual({ startTime: '23:00', endTime: '24:00' })
    })
  })

  describe('edge cases', () => {
    it('handles entries with null times gracefully', () => {
      const entries = [
        { ...createEntry('00:00', '01:00'), start_time: null } as unknown as TimeEntry,
        createEntry('02:00', '03:00'),
      ]
      // First entry (null) should be ignored, starts from 02:00, gap after is 03:00-04:00
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      expect(result).toEqual({ startTime: '03:00', endTime: '04:00' })
    })

    it('returns null when entire period is covered', () => {
      const entries = [createEntry('12:00', '18:00')] // Full afternoon
      const result = findFirstGapInPeriod(entries, 'afternoon', 60)
      expect(result).toBeNull()
    })

    it('returns gap when only tiny sliver remains', () => {
      const entries = [createEntry('12:00', '17:55')]
      const result = findFirstGapInPeriod(entries, 'afternoon', 60)
      // Only 5 minutes remain
      expect(result).toEqual({ startTime: '17:55', endTime: '18:00' })
    })

    it('handles maxDurationMins of 0', () => {
      const result = findFirstGapInPeriod([], 'afternoon', 0)
      expect(result).toEqual({ startTime: '12:00', endTime: '12:00' })
    })
  })

  describe('real-world scenario: entry crossing from morning to afternoon', () => {
    it('morning session with 11-13 entry has no gap (entry covers to period end)', () => {
      // This is the bug case: morning is 0-12, entry 11-13 crosses boundary
      const entries = [createEntry('11:00', '13:00')]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Starts from first entry (11:00), entry clamped to end at 12:00, no gap
      expect(result).toBeNull()
    })

    it('morning session with entries covering 0-11, entry 11-13 has no morning gap', () => {
      const entries = [
        createEntry('00:00', '11:00'),
        createEntry('11:00', '13:00'), // Crosses into afternoon
      ]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Morning is fully covered (0-12, entries cover 0-12 with clamping)
      expect(result).toBeNull()
    })

    it('finds gap between entries', () => {
      const entries = [
        createEntry('08:00', '10:00'),
        createEntry('11:00', '14:00'), // Ends at 14:00 but clamped to 12:00 for morning
      ]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Starts from first entry (08:00), gap is 10:00-11:00 (between entries)
      expect(result).toEqual({ startTime: '10:00', endTime: '11:00' })
    })
  })

  describe('user bug report: gap between 8:30 and 9:00', () => {
    it('finds the 30-minute gap between consecutive entries', () => {
      const entries = [
        createEntry('08:00', '08:30'), // Shower
        createEntry('09:00', '10:00'), // FSL102H1
        createEntry('10:00', '11:00'), // Admin
        createEntry('11:00', '13:00'), // ACT352H1
      ]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Should find the gap from 08:30 to 09:00
      expect(result).toEqual({ startTime: '08:30', endTime: '09:00' })
    })

    it('finds gap between non-consecutive entries', () => {
      const entries = [
        createEntry('08:00', '08:30'),
        createEntry('10:00', '11:00'),
      ]
      const result = findFirstGapInPeriod(entries, 'morning', 60)
      // Gap from 08:30 to 10:00, capped at 1 hour
      expect(result).toEqual({ startTime: '08:30', endTime: '09:30' })
    })
  })
})
