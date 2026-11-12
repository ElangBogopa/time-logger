/**
 * @jest-environment node
 *
 * The day's windows, moved to when a person wakes. The table was in clock
 * time for someone up at half past six, so an early riser and a night owl
 * were both handed that person's day.
 */

import {
  IDEAL_DAY,
  REFERENCE_WAKE_MINUTES,
  wakeShift,
  windowsForWake,
  windowAt,
  windowsOpenAt,
  fitAt,
  fitAtHour,
} from '@/lib/ideal-day'
import { suggestTimes } from '@/lib/suggest-times'
import { LIBRARY } from '@/lib/library'

const at = (h: number, m = 0) => h * 60 + m
const find = (windows: ReturnType<typeof windowsForWake>, label: string) => {
  const window = windows.find((w) => w.label === label)
  if (!window) throw new Error(`no window called ${label}`)
  return window
}

describe('wakeShift', () => {
  it('is nothing when the wake time is not known, or is the reference', () => {
    expect(wakeShift(null)).toBe(0)
    expect(wakeShift(REFERENCE_WAKE_MINUTES)).toBe(0)
  })

  it('moves by the difference, on a half-hour grid', () => {
    expect(wakeShift(at(7))).toBe(30)
    expect(wakeShift(at(5))).toBe(-90)
    expect(wakeShift(at(7, 10))).toBe(30)
    expect(wakeShift(at(8, 20))).toBe(120)
  })

  it('stops stretching the table past what it can support', () => {
    // Findings about a typical day say little about a 3am or a noon riser.
    expect(wakeShift(at(3))).toBe(-120)
    expect(wakeShift(at(13))).toBe(240)
  })
})

describe('windowsForWake', () => {
  it('is the table as written for the reference wake time', () => {
    const windows = windowsForWake(null)
    expect(windows).toHaveLength(IDEAL_DAY.length)
    expect(find(windows, 'Peak focus')).toMatchObject({ startMinutes: at(9), endMinutes: at(12) })
  })

  it('moves the body’s windows with a later riser', () => {
    const windows = windowsForWake(at(9)) // two and a half hours later
    expect(find(windows, 'Peak focus')).toMatchObject({ startMinutes: at(11, 30), endMinutes: at(14, 30) })
    expect(find(windows, 'Physical peak')).toMatchObject({ startMinutes: at(19, 30), endMinutes: at(21, 30) })
  })

  it('moves them earlier for an early riser', () => {
    const windows = windowsForWake(at(5))
    expect(find(windows, 'Peak focus')).toMatchObject({ startMinutes: at(7, 30), endMinutes: at(10, 30) })
  })

  it('opens no window of the body’s before you are up', () => {
    for (const wake of [at(5), at(7, 30), at(9)]) {
      for (const window of windowsForWake(wake).filter((w) => w.anchor === 'body')) {
        expect(window.startMinutes).toBeGreaterThanOrEqual(wake)
      }
    }
    // Up at 7:30: morning movement runs from then, not from seven.
    expect(find(windowsForWake(at(7, 30)), 'Morning movement')).toMatchObject({
      startMinutes: at(7, 30),
      endMinutes: at(9),
    })
  })

  it('leaves the windows about other people on the clock', () => {
    // Other people are free at lunch and in the evening whatever your chronotype.
    for (const wake of [at(5), at(7), at(10)]) {
      const windows = windowsForWake(wake)
      expect(find(windows, 'Midday, with people')).toMatchObject({ startMinutes: at(12), endMinutes: at(13) })
      expect(find(windows, 'People')).toMatchObject({ startMinutes: at(19), endMinutes: at(21) })
    }
  })

  it('keeps every window inside the day, in order', () => {
    const windows = windowsForWake(at(10, 30)) // the latest shift
    for (const window of windows) {
      expect(window.startMinutes).toBeGreaterThanOrEqual(0)
      expect(window.endMinutes).toBeLessThanOrEqual(24 * 60)
      expect(window.endMinutes).toBeGreaterThan(window.startMinutes)
    }
    const starts = windows.map((w) => w.startMinutes)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })

  it('gives every window a name, a colour bucket and a source that exists', () => {
    const ids = new Set(LIBRARY.map((entry) => entry.id))
    for (const window of windowsForWake(null)) {
      expect(window.label.length).toBeGreaterThan(0)
      expect(window.bucket).toBeTruthy()
      expect(ids.has(window.source)).toBe(true)
    }
  })
})

describe('reading a minute against the windows', () => {
  const late = windowsForWake(at(9))

  it('finds the window a category has at a minute', () => {
    expect(windowAt('deep_work', at(10))?.label).toBe('Peak focus')
    // For the later riser ten o'clock is still before the peak.
    expect(windowAt('deep_work', at(10), late)).toBeNull()
    expect(windowAt('deep_work', at(12), late)?.label).toBe('Peak focus')
  })

  it('scores a minute inside a window as a perfect fit, falling away outside', () => {
    expect(fitAt('deep_work', at(10))).toBe(1)
    expect(fitAt('deep_work', at(8))).toBeLessThan(1)
    expect(fitAt('deep_work', at(8))).toBeGreaterThan(fitAt('deep_work', at(6)))
    expect(fitAt('deep_work', at(10), late)).toBeLessThan(1)
  })

  it('has no opinion about a category with no window', () => {
    expect(fitAt('commute', at(10))).toBe(0.5)
  })

  it('agrees with the whole-hour reading it replaced', () => {
    expect(fitAtHour('exercise', 17)).toBe(fitAt('exercise', at(17)))
  })

  it('lists what is open now, the body’s window first', () => {
    // 12:15 for someone up at seven: still in peak focus (9:30–12:30), and lunch with people.
    const open = windowsOpenAt(at(12, 15), windowsForWake(at(7)))
    expect(open.map((w) => w.label)).toEqual(['Peak focus', 'Midday, with people'])
    expect(windowsOpenAt(at(3), windowsForWake(null))).toEqual([])
  })
})

describe('suggestions use your windows', () => {
  it('puts deep work in the peak of the person asking, not the reference day', () => {
    const task = [{ id: 'a', title: 'Write', category: 'deep_work' as const, durationMinutes: 60 }]
    const reference = suggestTimes({ tasks: task, busy: [] })
    const owl = suggestTimes({ tasks: task, busy: [], windows: windowsForWake(at(9)), earliestMinutes: at(9, 30) })

    expect(reference.suggestions[0].startTime).toBe('09:00')
    expect(owl.suggestions[0].startTime).toBe('11:30')
    expect(owl.suggestions[0].reason).toMatch(/peak cognitive/i)
  })
})
