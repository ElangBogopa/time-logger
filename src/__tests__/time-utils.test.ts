import {
  timeToMinutes,
  minutesToTime,
  formatDuration,
  formatDurationLong,
  formatTimeDisplay,
  formatHour,
  calculateDuration,
  addMinutesToTime,
  roundToNearest15,
  isTimeInRange,
  getTimeOfDay,
  formatHours,
} from '@/lib/time-utils'

describe('timeToMinutes', () => {
  it('converts midnight to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('converts noon to 720', () => {
    expect(timeToMinutes('12:00')).toBe(720)
  })

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('handles arbitrary times', () => {
    expect(timeToMinutes('14:30')).toBe(870)
    expect(timeToMinutes('09:15')).toBe(555)
  })
})

describe('minutesToTime', () => {
  it('converts 0 to 00:00', () => {
    expect(minutesToTime(0)).toBe('00:00')
  })

  it('converts 720 to 12:00', () => {
    expect(minutesToTime(720)).toBe('12:00')
  })

  it('converts 1439 to 23:59', () => {
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('wraps around past midnight', () => {
    expect(minutesToTime(1440)).toBe('00:00')
    expect(minutesToTime(1500)).toBe('01:00')
  })

  it('handles arbitrary minutes', () => {
    expect(minutesToTime(870)).toBe('14:30')
    expect(minutesToTime(555)).toBe('09:15')
  })
})

describe('formatDuration', () => {
  it('formats 0 minutes', () => {
    expect(formatDuration(0)).toBe('0m')
  })

  it('formats minutes under an hour', () => {
    expect(formatDuration(30)).toBe('30m')
    expect(formatDuration(45)).toBe('45m')
  })

  it('formats exact hours', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(120)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(150)).toBe('2h 30m')
  })

  it('handles negative values', () => {
    expect(formatDuration(-10)).toBe('0m')
  })
})

describe('formatDurationLong', () => {
  it('formats 0 minutes', () => {
    expect(formatDurationLong(0)).toBe('0 minutes')
  })

  it('formats 1 minute (singular)', () => {
    expect(formatDurationLong(1)).toBe('1 minute')
  })

  it('formats multiple minutes', () => {
    expect(formatDurationLong(30)).toBe('30 minutes')
  })

  it('formats 1 hour (singular)', () => {
    expect(formatDurationLong(60)).toBe('1 hour')
  })

  it('formats multiple hours', () => {
    expect(formatDurationLong(120)).toBe('2 hours')
  })

  it('formats hours and minutes', () => {
    expect(formatDurationLong(61)).toBe('1 hour 1 minute')
    expect(formatDurationLong(90)).toBe('1 hour 30 minutes')
    expect(formatDurationLong(150)).toBe('2 hours 30 minutes')
  })
})

describe('formatTimeDisplay', () => {
  it('formats midnight as 12:00 AM', () => {
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM')
  })

  it('formats noon as 12:00 PM', () => {
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM')
  })

  it('formats morning times', () => {
    expect(formatTimeDisplay('09:30')).toBe('9:30 AM')
  })

  it('formats afternoon times', () => {
    expect(formatTimeDisplay('14:30')).toBe('2:30 PM')
    expect(formatTimeDisplay('23:45')).toBe('11:45 PM')
  })

  it('handles empty string', () => {
    expect(formatTimeDisplay('')).toBe('')
  })
})

describe('formatHour', () => {
  it('formats midnight as 12am', () => {
    expect(formatHour(0)).toBe('12am')
  })

  it('formats noon as 12pm', () => {
    expect(formatHour(12)).toBe('12pm')
  })

  it('formats morning hours', () => {
    expect(formatHour(1)).toBe('1am')
    expect(formatHour(11)).toBe('11am')
  })

  it('formats afternoon hours', () => {
    expect(formatHour(13)).toBe('1pm')
    expect(formatHour(23)).toBe('11pm')
  })
})

describe('calculateDuration', () => {
  it('calculates simple duration', () => {
    expect(calculateDuration('09:00', '10:00')).toBe(60)
    expect(calculateDuration('14:00', '16:30')).toBe(150)
  })

  it('handles crossing midnight', () => {
    expect(calculateDuration('23:00', '01:00')).toBe(120)
    expect(calculateDuration('22:30', '00:30')).toBe(120)
  })

  it('returns 0 for empty inputs', () => {
    expect(calculateDuration('', '10:00')).toBe(0)
    expect(calculateDuration('09:00', '')).toBe(0)
  })
})

describe('addMinutesToTime', () => {
  it('adds minutes within same hour', () => {
    expect(addMinutesToTime('09:00', 30)).toBe('09:30')
  })

  it('adds minutes crossing hour boundary', () => {
    expect(addMinutesToTime('09:45', 30)).toBe('10:15')
  })

  it('wraps around midnight', () => {
    expect(addMinutesToTime('23:30', 60)).toBe('00:30')
  })
})

describe('roundToNearest15', () => {
  it('rounds down when closer to lower bound', () => {
    const date = new Date('2024-01-01T14:07:00')
    expect(roundToNearest15(date)).toBe('14:00')
  })

  it('rounds up when closer to upper bound', () => {
    const date = new Date('2024-01-01T14:38:00')
    expect(roundToNearest15(date)).toBe('14:45')
  })

  it('keeps exact 15-minute intervals', () => {
    const date = new Date('2024-01-01T14:30:00')
    expect(roundToNearest15(date)).toBe('14:30')
  })

  it('rounds up to next hour when needed', () => {
    const date = new Date('2024-01-01T14:53:00')
    expect(roundToNearest15(date)).toBe('15:00')
  })

  it('wraps around midnight', () => {
    const date = new Date('2024-01-01T23:53:00')
    expect(roundToNearest15(date)).toBe('00:00')
  })
})

describe('isTimeInRange', () => {
  it('returns true for time within range', () => {
    expect(isTimeInRange('10:00', '09:00', '11:00')).toBe(true)
    expect(isTimeInRange('09:00', '09:00', '11:00')).toBe(true) // inclusive start
    expect(isTimeInRange('11:00', '09:00', '11:00')).toBe(true) // inclusive end
  })

  it('returns false for time outside range', () => {
    expect(isTimeInRange('08:00', '09:00', '11:00')).toBe(false)
    expect(isTimeInRange('12:00', '09:00', '11:00')).toBe(false)
  })

  it('handles ranges crossing midnight', () => {
    expect(isTimeInRange('23:30', '22:00', '02:00')).toBe(true)
    expect(isTimeInRange('01:00', '22:00', '02:00')).toBe(true)
    expect(isTimeInRange('10:00', '22:00', '02:00')).toBe(false)
  })
})

describe('getTimeOfDay', () => {
  it('returns correct time of day descriptions', () => {
    expect(getTimeOfDay('03:00')).toBe('early morning')
    expect(getTimeOfDay('07:00')).toBe('morning')
    expect(getTimeOfDay('10:00')).toBe('late morning')
    expect(getTimeOfDay('12:30')).toBe('around midday')
    expect(getTimeOfDay('15:00')).toBe('afternoon')
    expect(getTimeOfDay('18:30')).toBe('evening')
    expect(getTimeOfDay('22:00')).toBe('night')
  })

  it('handles null input', () => {
    expect(getTimeOfDay(null)).toBe('sometime today')
  })
})

describe('formatHours', () => {
  it('formats minutes only', () => {
    expect(formatHours(30)).toBe('30m')
  })

  it('formats hours only', () => {
    expect(formatHours(120)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatHours(150)).toBe('2h 30m')
  })

  it('handles 0 minutes', () => {
    expect(formatHours(0)).toBe('0m')
  })
})
