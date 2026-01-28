import {
  getLocalDateString,
  isEntryInFuture,
  isDateLoggable,
  isPendingEntryReadyToConfirm,
  MAX_DAYS_BACK_FOR_LOGGING,
  TimeEntry,
  dayMeetsStreakRequirement,
  getNextMilestone,
  getRecentMilestone,
  calculateWeeklyConsistency,
  calculateStreakWithGrace,
  getWeekStartDate,
  STREAK_CONFIGS,
  StreakConfig,
} from '@/lib/types'

describe('getLocalDateString', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-03-15T10:30:00')
    expect(getLocalDateString(date)).toBe('2024-03-15')
  })

  it('pads single-digit months and days', () => {
    const date = new Date('2024-01-05T10:30:00')
    expect(getLocalDateString(date)).toBe('2024-01-05')
  })

  it('uses current date when no argument provided', () => {
    const result = getLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isEntryInFuture', () => {
  it('returns true for future entries', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = getLocalDateString(tomorrow)

    expect(isEntryInFuture(dateStr, '12:00')).toBe(true)
  })

  it('returns false for past entries', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = getLocalDateString(yesterday)

    expect(isEntryInFuture(dateStr, '12:00')).toBe(false)
  })

  it('returns false when endTime is null', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = getLocalDateString(tomorrow)

    expect(isEntryInFuture(dateStr, null)).toBe(false)
  })
})

describe('isDateLoggable', () => {
  it('returns true for today', () => {
    const today = getLocalDateString()
    expect(isDateLoggable(today)).toBe(true)
  })

  it('returns true for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isDateLoggable(getLocalDateString(yesterday))).toBe(true)
  })

  it('returns true for 2 days ago', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    expect(isDateLoggable(getLocalDateString(twoDaysAgo))).toBe(true)
  })

  it('returns false for 3+ days ago', () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    expect(isDateLoggable(getLocalDateString(threeDaysAgo))).toBe(false)
  })

  it('returns true for future dates', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(isDateLoggable(getLocalDateString(tomorrow))).toBe(true)
  })

  it('MAX_DAYS_BACK_FOR_LOGGING is 2', () => {
    expect(MAX_DAYS_BACK_FOR_LOGGING).toBe(2)
  })
})

describe('isPendingEntryReadyToConfirm', () => {
  const baseEntry: TimeEntry = {
    id: '1',
    user_id: 'user1',
    date: getLocalDateString(),
    activity: 'Test',
    category: null,
    duration_minutes: 60,
    start_time: '10:00',
    end_time: '11:00',
    description: null,
    commentary: null,
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  it('returns false for confirmed entries', () => {
    const entry = { ...baseEntry, status: 'confirmed' as const }
    expect(isPendingEntryReadyToConfirm(entry)).toBe(false)
  })

  it('returns false for entries without end_time', () => {
    const entry = { ...baseEntry, end_time: null }
    expect(isPendingEntryReadyToConfirm(entry)).toBe(false)
  })

  it('returns true for pending entry with past end_time', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const entry = {
      ...baseEntry,
      date: getLocalDateString(yesterday),
    }
    expect(isPendingEntryReadyToConfirm(entry)).toBe(true)
  })

  it('returns false for pending entry with future end_time', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const entry = {
      ...baseEntry,
      date: getLocalDateString(tomorrow),
    }
    expect(isPendingEntryReadyToConfirm(entry)).toBe(false)
  })
})

// ============================================================================
// STREAK SYSTEM TESTS
// ============================================================================

describe('dayMeetsStreakRequirement', () => {
  const makeEntry = (category: string, minutes: number): TimeEntry => ({
    id: '1',
    user_id: 'user1',
    date: '2024-01-15',
    activity: 'Test',
    category: category as TimeEntry['category'],
    duration_minutes: minutes,
    start_time: '10:00',
    end_time: '11:00',
    description: null,
    commentary: null,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  })

  describe('minutes threshold type', () => {
    const deepWorkConfig = STREAK_CONFIGS.deep_work

    it('returns true when minutes exceed threshold', () => {
      const entries = [makeEntry('deep_work', 130)]
      expect(dayMeetsStreakRequirement(entries, deepWorkConfig)).toBe(true)
    })

    it('returns true when minutes equal threshold', () => {
      const entries = [makeEntry('deep_work', 120)]
      expect(dayMeetsStreakRequirement(entries, deepWorkConfig)).toBe(true)
    })

    it('returns false when minutes below threshold', () => {
      const entries = [makeEntry('deep_work', 119)]
      expect(dayMeetsStreakRequirement(entries, deepWorkConfig)).toBe(false)
    })

    it('sums multiple entries', () => {
      const entries = [makeEntry('deep_work', 60), makeEntry('deep_work', 60)]
      expect(dayMeetsStreakRequirement(entries, deepWorkConfig)).toBe(true)
    })

    it('ignores other categories', () => {
      const entries = [makeEntry('deep_work', 60), makeEntry('exercise', 120)]
      expect(dayMeetsStreakRequirement(entries, deepWorkConfig)).toBe(false)
    })

    it('ignores pending entries', () => {
      const pendingEntry = { ...makeEntry('deep_work', 120), status: 'pending' as const }
      expect(dayMeetsStreakRequirement([pendingEntry], deepWorkConfig)).toBe(false)
    })
  })

  describe('entries threshold type', () => {
    const exerciseConfig = STREAK_CONFIGS.exercise

    it('returns true when any entry exists', () => {
      const entries = [makeEntry('exercise', 30)]
      expect(dayMeetsStreakRequirement(entries, exerciseConfig)).toBe(true)
    })

    it('returns false when no entries exist', () => {
      const entries: TimeEntry[] = []
      expect(dayMeetsStreakRequirement(entries, exerciseConfig)).toBe(false)
    })

    it('returns false when only other categories exist', () => {
      const entries = [makeEntry('deep_work', 120)]
      expect(dayMeetsStreakRequirement(entries, exerciseConfig)).toBe(false)
    })
  })

  describe('absence threshold type', () => {
    const focusConfig = STREAK_CONFIGS.focus

    it('returns true when user was active but no distraction', () => {
      const entries = [makeEntry('deep_work', 120)]
      expect(dayMeetsStreakRequirement(entries, focusConfig)).toBe(true)
    })

    it('returns false when entertainment exists', () => {
      const entries = [makeEntry('deep_work', 120), makeEntry('entertainment', 30)]
      expect(dayMeetsStreakRequirement(entries, focusConfig)).toBe(false)
    })

    it('returns false when no entries (user inactive)', () => {
      const entries: TimeEntry[] = []
      expect(dayMeetsStreakRequirement(entries, focusConfig)).toBe(false)
    })
  })
})

describe('getNextMilestone', () => {
  const milestones = [7, 14, 30, 60, 100, 365]

  it('returns first milestone when streak is 0', () => {
    expect(getNextMilestone(0, milestones)).toBe(7)
  })

  it('returns next milestone when between milestones', () => {
    expect(getNextMilestone(10, milestones)).toBe(14)
    expect(getNextMilestone(20, milestones)).toBe(30)
  })

  it('returns null when past all milestones', () => {
    expect(getNextMilestone(400, milestones)).toBe(null)
  })

  it('returns next when exactly at milestone', () => {
    expect(getNextMilestone(7, milestones)).toBe(14)
    expect(getNextMilestone(30, milestones)).toBe(60)
  })
})

describe('getRecentMilestone', () => {
  const milestones = [7, 14, 30, 60, 100, 365]

  it('returns null when below first milestone', () => {
    expect(getRecentMilestone(5, milestones)).toBe(null)
  })

  it('returns milestone when exactly at it', () => {
    expect(getRecentMilestone(7, milestones)).toBe(7)
    expect(getRecentMilestone(30, milestones)).toBe(30)
  })

  it('returns previous milestone when between', () => {
    expect(getRecentMilestone(10, milestones)).toBe(7)
    expect(getRecentMilestone(50, milestones)).toBe(30)
  })

  it('returns highest when past all milestones', () => {
    expect(getRecentMilestone(400, milestones)).toBe(365)
  })
})

describe('getWeekStartDate', () => {
  it('returns Sunday of current week', () => {
    // Wednesday Jan 15, 2025
    const wednesday = new Date('2025-01-15T12:00:00')
    expect(getWeekStartDate(wednesday)).toBe('2025-01-12') // Sunday
  })

  it('returns same day if already Sunday', () => {
    const sunday = new Date('2025-01-12T12:00:00')
    expect(getWeekStartDate(sunday)).toBe('2025-01-12')
  })

  it('returns previous Sunday for Saturday', () => {
    const saturday = new Date('2025-01-18T12:00:00')
    expect(getWeekStartDate(saturday)).toBe('2025-01-12')
  })
})

describe('calculateWeeklyConsistency', () => {
  const makeEntry = (date: string, category: string, minutes: number): TimeEntry => ({
    id: Math.random().toString(),
    user_id: 'user1',
    date,
    activity: 'Test',
    category: category as TimeEntry['category'],
    duration_minutes: minutes,
    start_time: '10:00',
    end_time: '11:00',
    description: null,
    commentary: null,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  })

  it('calculates perfect week correctly', () => {
    const weekStart = '2024-01-07' // A Sunday
    const entriesByDate = new Map<string, TimeEntry[]>()

    // Add entries for all 7 days with 2+ hours deep work
    for (let i = 0; i < 7; i++) {
      const date = new Date('2024-01-07T00:00:00')
      date.setDate(date.getDate() + i)
      const dateStr = getLocalDateString(date)
      entriesByDate.set(dateStr, [makeEntry(dateStr, 'deep_work', 120)])
    }

    // Use a date in the past so all days count
    const mockToday = new Date('2024-01-14T12:00:00')
    const originalDate = Date
    global.Date = class extends originalDate {
      constructor(...args: (string | number | Date)[]) {
        super()
        if (args.length === 0) {
          return mockToday as unknown as Date
        }
        return new originalDate(...(args as [string | number | Date])) as unknown as Date
      }
      static now() {
        return mockToday.getTime()
      }
    } as DateConstructor

    const result = calculateWeeklyConsistency(entriesByDate, STREAK_CONFIGS.deep_work, weekStart)

    global.Date = originalDate

    expect(result.daysHit).toBe(7)
    expect(result.totalDays).toBe(7)
    expect(result.percentage).toBe(100)
    expect(result.isPerfect).toBe(true)
  })

  it('handles partial week correctly', () => {
    const weekStart = '2024-01-07'
    const entriesByDate = new Map<string, TimeEntry[]>()

    // Only add entries for 3 days
    entriesByDate.set('2024-01-07', [makeEntry('2024-01-07', 'deep_work', 120)])
    entriesByDate.set('2024-01-08', [makeEntry('2024-01-08', 'deep_work', 60)]) // Not enough
    entriesByDate.set('2024-01-09', [makeEntry('2024-01-09', 'deep_work', 120)])

    const mockToday = new Date('2024-01-14T12:00:00')
    const originalDate = Date
    global.Date = class extends originalDate {
      constructor(...args: (string | number | Date)[]) {
        super()
        if (args.length === 0) {
          return mockToday as unknown as Date
        }
        return new originalDate(...(args as [string | number | Date])) as unknown as Date
      }
      static now() {
        return mockToday.getTime()
      }
    } as DateConstructor

    const result = calculateWeeklyConsistency(entriesByDate, STREAK_CONFIGS.deep_work, weekStart)

    global.Date = originalDate

    expect(result.daysHit).toBe(2) // Only 2 days with 120+ min
    expect(result.totalDays).toBe(3) // 3 active days
    expect(result.isPerfect).toBe(false)
  })
})

describe('calculateStreakWithGrace', () => {
  const makeEntry = (date: string, category: string, minutes: number): TimeEntry => ({
    id: Math.random().toString(),
    user_id: 'user1',
    date,
    activity: 'Test',
    category: category as TimeEntry['category'],
    duration_minutes: minutes,
    start_time: '10:00',
    end_time: '11:00',
    description: null,
    commentary: null,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  })

  it('calculates basic streak without grace days', () => {
    const entriesByDate = new Map<string, TimeEntry[]>()

    // Set up: today is 2024-01-15, streak from 3 consecutive days
    // Use deep_work with only 1 grace day to make test more precise
    const mockToday = new Date('2024-01-15T12:00:00')
    const originalDate = Date
    global.Date = class extends originalDate {
      constructor(...args: (string | number | Date)[]) {
        super()
        if (args.length === 0) {
          return mockToday as unknown as Date
        }
        return new originalDate(...(args as [string | number | Date])) as unknown as Date
      }
      static now() {
        return mockToday.getTime()
      }
    } as DateConstructor

    // Add 3 days of deep work (yesterday, day before, day before that)
    // Then add a day with activity but NOT meeting requirement to break the streak
    entriesByDate.set('2024-01-14', [makeEntry('2024-01-14', 'deep_work', 120)])
    entriesByDate.set('2024-01-13', [makeEntry('2024-01-13', 'deep_work', 120)])
    entriesByDate.set('2024-01-12', [makeEntry('2024-01-12', 'deep_work', 120)])
    // Day 11: active but not enough deep work (breaks streak after 1 grace day used)
    entriesByDate.set('2024-01-11', [makeEntry('2024-01-11', 'admin', 60)])
    entriesByDate.set('2024-01-10', [makeEntry('2024-01-10', 'admin', 60)])

    const result = calculateStreakWithGrace(entriesByDate, STREAK_CONFIGS.deep_work, 0)

    global.Date = originalDate

    // 3 consecutive days + 1 grace day for Jan 11 = 4 days
    // Then streak breaks at Jan 10 (no more grace days in that week)
    expect(result.currentStreak).toBe(4)
    expect(result.graceDaysUsed).toBe(1)
  })

  it('uses grace days to extend streak', () => {
    const entriesByDate = new Map<string, TimeEntry[]>()

    const mockToday = new Date('2024-01-15T12:00:00')
    const originalDate = Date
    global.Date = class extends originalDate {
      constructor(...args: (string | number | Date)[]) {
        super()
        if (args.length === 0) {
          return mockToday as unknown as Date
        }
        return new originalDate(...(args as [string | number | Date])) as unknown as Date
      }
      static now() {
        return mockToday.getTime()
      }
    } as DateConstructor

    // Day 14: deep work (meets requirement)
    // Day 13: admin only (doesn't meet, uses grace)
    // Day 12: deep work (meets requirement)
    // Day 11: admin only (doesn't meet, but no grace left for deep_work which has 1/week)
    entriesByDate.set('2024-01-14', [makeEntry('2024-01-14', 'deep_work', 120)])
    entriesByDate.set('2024-01-13', [makeEntry('2024-01-13', 'admin', 60)]) // Grace day
    entriesByDate.set('2024-01-12', [makeEntry('2024-01-12', 'deep_work', 120)])
    entriesByDate.set('2024-01-11', [makeEntry('2024-01-11', 'admin', 60)]) // Would need another grace

    const result = calculateStreakWithGrace(entriesByDate, STREAK_CONFIGS.deep_work, 0)

    global.Date = originalDate

    // Deep work has 1 grace day per week
    // Jan 14 (hit) + Jan 13 (grace) + Jan 12 (hit) = 3 days, then streak breaks
    expect(result.currentStreak).toBe(3)
    expect(result.graceDaysUsed).toBe(1)
  })

  it('tracks personal best correctly', () => {
    const entriesByDate = new Map<string, TimeEntry[]>()

    const mockToday = new Date('2024-01-15T12:00:00')
    const originalDate = Date
    global.Date = class extends originalDate {
      constructor(...args: (string | number | Date)[]) {
        super()
        if (args.length === 0) {
          return mockToday as unknown as Date
        }
        return new originalDate(...(args as [string | number | Date])) as unknown as Date
      }
      static now() {
        return mockToday.getTime()
      }
    } as DateConstructor

    // 5 day streak with a break before it
    for (let i = 1; i <= 5; i++) {
      const date = new Date('2024-01-15T00:00:00')
      date.setDate(date.getDate() - i)
      const dateStr = getLocalDateString(date)
      entriesByDate.set(dateStr, [makeEntry(dateStr, 'deep_work', 120)])
    }
    // Add entries that break the streak (active but not meeting requirement, exhausts grace)
    entriesByDate.set('2024-01-09', [makeEntry('2024-01-09', 'admin', 60)])
    entriesByDate.set('2024-01-08', [makeEntry('2024-01-08', 'admin', 60)])

    // Existing personal best is 3
    const result = calculateStreakWithGrace(entriesByDate, STREAK_CONFIGS.deep_work, 3)

    global.Date = originalDate

    // 5 days + 1 grace (Jan 9) = 6, then breaks at Jan 8
    expect(result.currentStreak).toBe(6)
    expect(result.personalBest).toBe(6)
    expect(result.isNewPersonalBest).toBe(true)
  })

  it('preserves existing personal best when current is lower', () => {
    const entriesByDate = new Map<string, TimeEntry[]>()

    const mockToday = new Date('2024-01-15T12:00:00')
    const originalDate = Date
    global.Date = class extends originalDate {
      constructor(...args: (string | number | Date)[]) {
        super()
        if (args.length === 0) {
          return mockToday as unknown as Date
        }
        return new originalDate(...(args as [string | number | Date])) as unknown as Date
      }
      static now() {
        return mockToday.getTime()
      }
    } as DateConstructor

    // 2 day streak with clear break
    entriesByDate.set('2024-01-14', [makeEntry('2024-01-14', 'deep_work', 120)])
    entriesByDate.set('2024-01-13', [makeEntry('2024-01-13', 'deep_work', 120)])
    // Break: 2 days of not meeting requirement (exhausts grace + breaks)
    entriesByDate.set('2024-01-12', [makeEntry('2024-01-12', 'admin', 60)])
    entriesByDate.set('2024-01-11', [makeEntry('2024-01-11', 'admin', 60)])

    // Existing personal best is 10
    const result = calculateStreakWithGrace(entriesByDate, STREAK_CONFIGS.deep_work, 10)

    global.Date = originalDate

    // 2 days + 1 grace (Jan 12) = 3, then breaks at Jan 11
    expect(result.currentStreak).toBe(3)
    expect(result.personalBest).toBe(10)
    expect(result.isNewPersonalBest).toBe(false)
  })
})
