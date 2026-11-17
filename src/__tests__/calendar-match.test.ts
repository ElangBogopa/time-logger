import { isEventLogged, unconfirmedEvents } from '@/lib/calendar-match'

const event = (startTime: string, endTime: string) => ({ startTime, endTime })
const entry = (start_time: string | null, end_time: string | null) => ({ start_time, end_time })

describe('isEventLogged', () => {
  it('is false with nothing logged', () => {
    expect(isEventLogged(event('14:00', '15:00'), [])).toBe(false)
  })

  it('is true once an entry covers the event', () => {
    expect(isEventLogged(event('14:00', '15:00'), [entry('14:00', '15:00')])).toBe(true)
  })

  it('is true when a longer entry swallows a short event', () => {
    expect(isEventLogged(event('09:30', '09:45'), [entry('09:00', '11:30')])).toBe(true)
  })

  it('needs more than half the event covered', () => {
    expect(isEventLogged(event('14:00', '15:00'), [entry('14:30', '16:00')])).toBe(false)
    expect(isEventLogged(event('14:00', '15:00'), [entry('14:20', '16:00')])).toBe(true)
  })

  it('ignores entries without times', () => {
    expect(isEventLogged(event('14:00', '15:00'), [entry(null, null)])).toBe(false)
  })

  it('never matches an event with no length', () => {
    expect(isEventLogged(event('14:00', '14:00'), [entry('13:00', '15:00')])).toBe(false)
  })
})

describe('unconfirmedEvents', () => {
  it('keeps only the events nothing has answered', () => {
    const standup = { id: 'a', ...event('09:30', '09:45') }
    const review = { id: 'b', ...event('14:00', '15:00') }
    expect(unconfirmedEvents([standup, review], [entry('14:00', '15:00')])).toEqual([standup])
  })
})

describe('an event that crosses midnight', () => {
  const late = event('22:00', '01:00')

  it('is not logged with nothing saved', () => {
    expect(isEventLogged(late, [])).toBe(false)
  })

  it('is logged once the evening piece of its split is saved', () => {
    expect(isEventLogged(late, [entry('22:00', '24:00')])).toBe(true)
  })

  it('is logged as a one-piece sleep, and with stored seconds', () => {
    expect(isEventLogged(event('23:00', '07:00'), [entry('23:00:00', '07:00:00')])).toBe(true)
  })

  it('is not logged by something that only touches its edge', () => {
    expect(isEventLogged(late, [entry('20:00', '22:30')])).toBe(false)
  })

  it('leaves the list once confirmed', () => {
    const e = { id: 'x', ...late }
    expect(unconfirmedEvents([e], [entry('22:00', '24:00')])).toEqual([])
  })

  it('treats an event that ends at 00:00 like one that ends at midnight', () => {
    expect(isEventLogged(event('23:00', '00:00'), [entry('23:00', '24:00')])).toBe(true)
  })
})

// Entries are read where they sit on their own date (`onDayTimes`), never
// by their raw times.
describe('last night\'s sleep, stored on the morning it ended', () => {
  // Monday night's 22:30-06:30, dated Tuesday: 00:00-06:30 on Tuesday.
  const lastNight = [entry('22:30', '06:30')]

  it.each([
    ['23:00', '23:30'],
    ['22:30', '24:00'],
    ['22:00', '01:00'],
    ['23:00', '00:00'],
    ['23:00', '03:00'],
  ])('does not answer that evening\'s %s-%s event', (start, end) => {
    expect(isEventLogged(event(start, end), lastNight)).toBe(false)
    expect(isEventLogged(event(start, end), [entry('22:30:00', '06:30:00')])).toBe(false)
  })

  it('still answers what happened inside the morning part', () => {
    expect(isEventLogged(event('05:00', '06:00'), lastNight)).toBe(true)
  })

  it('leaves the evening\'s events in the list', () => {
    const events = [
      { id: 'a', ...event('23:00', '23:30') },
      { id: 'b', ...event('22:30', '24:00') },
      { id: 'c', ...event('22:00', '01:00') },
    ]
    expect(unconfirmedEvents(events, lastNight)).toEqual(events)
  })
})

describe('an event confirmed as something other than sleep', () => {
  it('is answered by the evening piece on its day, and not by the morning piece alone', () => {
    expect(isEventLogged(event('22:00', '01:00'), [entry('22:00', '24:00')])).toBe(true)
    expect(isEventLogged(event('22:00', '01:00'), [entry('22:00:00', '24:00:00')])).toBe(true)
    // The next day's list holds the 00:00-01:00 piece; the event is not on it.
    expect(isEventLogged(event('22:00', '01:00'), [entry('00:00', '01:00')])).toBe(false)
  })

  it('is answered by its evening piece when more of it lies after midnight', () => {
    expect(isEventLogged(event('23:00', '03:00'), [entry('23:00', '24:00')])).toBe(true)
  })
})

describe('a sleep confirmed from an event that crosses midnight', () => {
  it('answers its event as the one row saved on the event\'s date', () => {
    expect(isEventLogged(event('23:00', '07:00'), [entry('23:00', '07:00')])).toBe(true)
    expect(isEventLogged(event('22:30', '06:30'), [entry('22:30:00', '06:30:00')])).toBe(true)
    expect(isEventLogged(event('00:30', '00:15'), [entry('00:30', '00:15')])).toBe(true)
  })

  it('answers it when more of it lies before midnight too', () => {
    expect(isEventLogged(event('20:00', '03:00'), [entry('20:00', '03:00')])).toBe(true)
    expect(isEventLogged(event('22:00', '01:00'), [entry('22:00', '01:00')])).toBe(true)
  })

  it('answers it when the times were nudged in the sheet', () => {
    expect(isEventLogged(event('23:00', '07:00'), [entry('23:30', '06:30')])).toBe(true)
  })

  it('does not answer a different, shorter night event', () => {
    expect(isEventLogged(event('23:30', '02:00'), [entry('22:30', '06:30')])).toBe(false)
  })

  it('leaves the list', () => {
    const sleep = { id: 's', ...event('23:00', '07:00') }
    expect(unconfirmedEvents([sleep], [entry('23:00', '07:00')])).toEqual([])
  })
})

describe('entries that end at midnight', () => {
  it('reads an end of 00:00 or 24:00 as the end of the day', () => {
    expect(isEventLogged(event('23:00', '23:30'), [entry('22:00', '00:00')])).toBe(true)
    expect(isEventLogged(event('23:00', '23:30'), [entry('22:00', '24:00')])).toBe(true)
  })

  it('ignores an entry with a start and no end', () => {
    expect(isEventLogged(event('14:00', '15:00'), [entry('14:00', null)])).toBe(false)
  })
})
