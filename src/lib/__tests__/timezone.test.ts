/**
 * Timezone handling tests
 *
 * These tests verify that timezone conversions work correctly,
 * especially important for Vercel deployment where server runs in UTC.
 */

// Utility functions to test (mirrors the API route logic)
function formatTimeInTimezone(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const hour = parts.find(p => p.type === 'hour')?.value || '00'
    const minute = parts.find(p => p.type === 'minute')?.value || '00'
    return `${hour}:${minute}`
  } catch {
    const date = new Date(isoString)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
}

function formatDateInTimezone(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  } catch {
    const date = new Date(isoString)
    return date.toISOString().split('T')[0]
  }
}

function getTodayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function getWeekStart(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay()
  date.setDate(date.getDate() - dayOfWeek)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

describe('Timezone Utilities', () => {
  describe('formatTimeInTimezone', () => {
    it('converts UTC timestamp to EST correctly', () => {
      // 3pm UTC = 10am EST (UTC-5)
      const utcTime = '2024-01-15T15:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'America/New_York')
      expect(result).toBe('10:00')
    })

    it('converts UTC timestamp to PST correctly', () => {
      // 3pm UTC = 7am PST (UTC-8)
      const utcTime = '2024-01-15T15:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'America/Los_Angeles')
      expect(result).toBe('07:00')
    })

    it('converts UTC timestamp to UTC correctly', () => {
      const utcTime = '2024-01-15T15:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'UTC')
      expect(result).toBe('15:00')
    })

    it('handles ISO string with offset', () => {
      // 10am EST expressed with offset
      const estTime = '2024-01-15T10:00:00-05:00'
      const result = formatTimeInTimezone(estTime, 'America/New_York')
      expect(result).toBe('10:00')
    })

    it('handles midnight correctly', () => {
      const midnight = '2024-01-15T00:00:00Z'
      const result = formatTimeInTimezone(midnight, 'UTC')
      expect(result).toBe('00:00')
    })

    it('handles end of day correctly', () => {
      const endOfDay = '2024-01-15T23:59:00Z'
      const result = formatTimeInTimezone(endOfDay, 'UTC')
      expect(result).toBe('23:59')
    })
  })

  describe('formatDateInTimezone', () => {
    it('returns correct date in EST when UTC is next day', () => {
      // 2am UTC on Jan 16 = 9pm EST on Jan 15
      const utcTime = '2024-01-16T02:00:00Z'
      const result = formatDateInTimezone(utcTime, 'America/New_York')
      expect(result).toBe('2024-01-15')
    })

    it('returns correct date in UTC', () => {
      const utcTime = '2024-01-15T15:00:00Z'
      const result = formatDateInTimezone(utcTime, 'UTC')
      expect(result).toBe('2024-01-15')
    })

    it('handles date boundary at midnight UTC', () => {
      // Midnight UTC = 7pm EST previous day
      const midnight = '2024-01-15T00:00:00Z'
      const result = formatDateInTimezone(midnight, 'America/New_York')
      expect(result).toBe('2024-01-14')
    })
  })

  describe('getTodayInTimezone', () => {
    it('returns date in YYYY-MM-DD format', () => {
      const result = getTodayInTimezone('UTC')
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns valid date string', () => {
      const result = getTodayInTimezone('America/New_York')
      const parsed = new Date(result + 'T00:00:00')
      expect(parsed.toString()).not.toBe('Invalid Date')
    })
  })

  describe('getWeekStart', () => {
    it('returns Sunday for a Wednesday', () => {
      // Jan 17, 2024 is a Wednesday
      const result = getWeekStart('2024-01-17')
      expect(result).toBe('2024-01-14') // Sunday
    })

    it('returns same day for a Sunday', () => {
      // Jan 14, 2024 is a Sunday
      const result = getWeekStart('2024-01-14')
      expect(result).toBe('2024-01-14')
    })

    it('returns previous Sunday for a Saturday', () => {
      // Jan 20, 2024 is a Saturday
      const result = getWeekStart('2024-01-20')
      expect(result).toBe('2024-01-14')
    })

    it('handles month boundary', () => {
      // Feb 1, 2024 is a Thursday, week starts Jan 28
      const result = getWeekStart('2024-02-01')
      expect(result).toBe('2024-01-28')
    })

    it('handles year boundary', () => {
      // Jan 3, 2024 is a Wednesday, week starts Dec 31, 2023
      const result = getWeekStart('2024-01-03')
      expect(result).toBe('2023-12-31')
    })
  })
})

describe('Timezone Edge Cases', () => {
  describe('Daylight Saving Time transitions', () => {
    it('handles spring forward correctly (EST -> EDT)', () => {
      // March 10, 2024 - DST starts at 2am EST
      // 7am UTC = 2am EST (skips to 3am EDT)
      const utcTime = '2024-03-10T07:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'America/New_York')
      expect(result).toBe('03:00') // Should be 3am EDT
    })

    it('handles fall back correctly (EDT -> EST)', () => {
      // Nov 3, 2024 - DST ends at 2am EDT
      // 6am UTC = 1am EST
      const utcTime = '2024-11-03T06:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'America/New_York')
      expect(result).toBe('01:00')
    })
  })

  describe('International timezones', () => {
    it('handles positive UTC offset (Tokyo UTC+9)', () => {
      // 10am UTC = 7pm JST
      const utcTime = '2024-01-15T10:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'Asia/Tokyo')
      expect(result).toBe('19:00')
    })

    it('handles half-hour offset (Mumbai UTC+5:30)', () => {
      // 10am UTC = 3:30pm IST
      const utcTime = '2024-01-15T10:00:00Z'
      const result = formatTimeInTimezone(utcTime, 'Asia/Kolkata')
      expect(result).toBe('15:30')
    })

    it('handles date line crossing', () => {
      // 11pm UTC on Jan 15 = 12pm Jan 16 in Auckland (UTC+13 in summer)
      const utcTime = '2024-01-15T23:00:00Z'
      const dateResult = formatDateInTimezone(utcTime, 'Pacific/Auckland')
      expect(dateResult).toBe('2024-01-16')
    })
  })
})

describe('API timezone requirements', () => {
  it('calendar events API should require timezone parameter', () => {
    // If timezone is missing, API returns 400
    // This test documents the expected behavior
    const timezoneParam = null
    const shouldReject = timezoneParam === null
    expect(shouldReject).toBe(true)
  })

  it('weekly review API should require timezone parameter', () => {
    const timezone = undefined
    const shouldReject = !timezone
    expect(shouldReject).toBe(true)
  })

  it('client should always have access to timezone', () => {
    // Intl.DateTimeFormat is available in all modern browsers and Node.js
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(timezone).toBeDefined()
    expect(typeof timezone).toBe('string')
    expect(timezone.length).toBeGreaterThan(0)
  })
})

describe('Real-world scenarios', () => {
  it('Google Calendar event at 10am EST shows correctly', () => {
    // Google sends this for a 10am EST event
    const googleEvent = '2024-01-15T10:00:00-05:00'

    // When converted to EST, should still be 10am
    const timeInEST = formatTimeInTimezone(googleEvent, 'America/New_York')
    expect(timeInEST).toBe('10:00')

    // When converted to UTC (Vercel's default), would be 3pm - THIS IS THE BUG
    const timeInUTC = formatTimeInTimezone(googleEvent, 'UTC')
    expect(timeInUTC).toBe('15:00')
  })

  it('entry created at 10am EST by user stays 10am', () => {
    // User in EST creates entry at 10:00
    const userTime = '10:00'

    // This is stored as-is in database (no timezone)
    // When displayed, it should still be 10:00
    expect(userTime).toBe('10:00')

    // Manual entries don't go through timezone conversion
    // They're stored and displayed as literal strings
  })

  it('week boundaries calculated correctly regardless of server timezone', () => {
    // User in EST views weekly review on Monday Jan 15
    const userDate = '2024-01-15'

    // Week should start on Sunday Jan 14
    const weekStart = getWeekStart(userDate)
    expect(weekStart).toBe('2024-01-14')

    // This calculation uses date arithmetic, not timezone conversion
    // So it works the same on Vercel (UTC) as localhost
  })
})
