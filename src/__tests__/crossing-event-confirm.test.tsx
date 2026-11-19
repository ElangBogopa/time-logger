/**
 * A calendar event that runs past midnight, once confirmed, is answered
 * everywhere: Next up stops offering it and the confirm sheet refuses a
 * second confirm. An older one-piece night (a sleep saved before every
 * crossing entry was split), stored on the morning it ended, answers nothing
 * that evening. The rule is in lib/calendar-match.ts.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

Element.prototype.scrollTo = jest.fn()

jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  createEntry: jest.fn(async (row: Record<string, unknown>) => ({ id: 'new', ...row })),
  updateEntry: jest.fn(async () => ({})),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({ category: 'other', commentary: null }) })),
}))

import GhostEntryModal from '@/components/GhostEntryModal'
import { buildNextUp } from '@/lib/next-up'
import { fetchEntries, createEntry } from '@/lib/api'

// A day long past, so every event on it has ended.
const DATE = '2026-11-10'

const calendarEvent = (startTime: string, endTime: string, title = 'Late thing') => ({
  id: `${startTime}-${endTime}`, title, startTime, endTime, date: DATE, isAllDay: false,
})

const row = (activity: string, start_time: string, end_time: string) => ({
  id: activity, activity, start_time, end_time, duration_minutes: 60,
})

const offered = (event: ReturnType<typeof calendarEvent>, entries: ReturnType<typeof row>[]) =>
  buildNextUp({ plans: [], entries, events: [event], nowMinutes: 12 * 60 }).items.map((i) => i.title)

async function confirm(event: ReturnType<typeof calendarEvent>, entries: ReturnType<typeof row>[]) {
  ;(fetchEntries as jest.Mock).mockResolvedValue(entries)
  render(
    <GhostEntryModal event={event as never} onClose={jest.fn()} onConfirm={jest.fn()} userId="u1" selectedDate={DATE} />
  )
  fireEvent.click(screen.getByRole('button', { name: /confirm entry/i }))
  await waitFor(() => expect(fetchEntries).toHaveBeenCalled())
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('an event 22:00-01:00 confirmed as two entries', () => {
  const event = calendarEvent('22:00', '01:00')
  const evening = [row('Late thing', '22:00:00', '24:00:00')]

  it('is no longer offered in Next up', () => {
    expect(offered(event, [])).toEqual(['Late thing'])
    expect(offered(event, evening)).toEqual([])
  })

  it('is refused a second confirm', async () => {
    await confirm(event, evening)
    await screen.findByText(/overlaps with "Late thing"/i)
    expect(createEntry).not.toHaveBeenCalled()
  })
})

describe('an older one-piece night, 22:30-06:30 on the morning\'s date', () => {
  const lastNight = [row('Sleep', '22:30:00', '06:30:00')]

  it.each([
    ['23:00', '23:30'],
    ['22:30', '24:00'],
    ['22:00', '01:00'],
  ])('leaves that evening\'s %s-%s event offered, and lets it be confirmed', async (start, end) => {
    const event = calendarEvent(start, end)
    expect(offered(event, lastNight)).toEqual(['Late thing'])

    await confirm(event, lastNight)
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/overlaps with/i)).toBeNull()
  })
})

describe('an older one-piece row saved from an event that crosses midnight', () => {
  const event = calendarEvent('23:00', '07:00', 'Sleep')
  const saved = [row('Sleep', '23:00:00', '07:00:00')]

  it('is not offered again', () => {
    expect(offered(event, saved)).toEqual([])
  })

  it('is not offered again once confirmed as two pieces either', () => {
    expect(offered(event, [row('Sleep', '23:00:00', '24:00:00')])).toEqual([])
  })

  it('adds no second row on a second confirm', async () => {
    await confirm(event, saved)
    await screen.findByText(/overlaps with "Sleep"/i)
    expect(createEntry).not.toHaveBeenCalled()
  })
})

describe('an ordinary event', () => {
  it('is refused when an entry already covers more than half of it, and saved otherwise', async () => {
    const event = calendarEvent('14:00', '15:00', 'Review')
    expect(offered(event, [row('Desk', '14:20:00', '16:00:00')])).toEqual([])
    expect(offered(event, [row('Desk', '14:30:00', '16:00:00')])).toEqual(['Review'])

    await confirm(event, [row('Desk', '14:20:00', '16:00:00')])
    await screen.findByText(/overlaps with "Desk"/i)
    expect(createEntry).not.toHaveBeenCalled()
  })
})
