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
