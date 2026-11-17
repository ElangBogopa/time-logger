/**
 * A gap row opens the add sheet at its times. Guards that the sheet lets a
 * stretch start at 12:00 on today, even beside a calendar event and a
 * later entry.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

Element.prototype.scrollTo = jest.fn()

jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => [
    {
      id: 'e1', user_id: 'u1', date: '2026-11-03', activity: 'Report', category: 'deep_work',
      start_time: '14:00', end_time: '15:00', duration_minutes: 60, status: 'confirmed',
    },
  ]),
  createEntry: jest.fn(async (row: Record<string, unknown>) => ({ id: 'new', ...row })),
  updateEntry: jest.fn(async () => ({})),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({ category: 'meals' }) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getRealToday: () => '2026-11-03',
}))

import QuickLogModal from '@/components/QuickLogModal'
import { createEntry } from '@/lib/api'

describe('QuickLogModal opened from a gap row', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15)
    jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
  })
  afterEach(() => jest.restoreAllMocks())

  it('saves 12:00 to 1:00 beside a calendar event and a later entry', async () => {
    render(
      <QuickLogModal
        isOpen
        onClose={jest.fn()}
        onEntryAdded={jest.fn()}
        selectedDate="2026-11-03"
        isPastDay={false}
        userId="u1"
        lastEntryEndTime={null}
        disablePostSubmit
        initialStartTime="12:00"
        initialEndTime="14:00"
        calendarEvents={[{ id: 'c1', title: 'Team lunch', startTime: '11:30', endTime: '12:30' } as never]}
      />
    )

    const input = screen.getByPlaceholderText(/lunch 12-1pm/)
    fireEvent.change(input, { target: { value: 'Lunch' } })

    fireEvent.click(screen.getByText(/12:00\s?PM/))
    fireEvent.click(screen.getAllByText(/^1:00\s?PM$/)[1])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    const row = (createEntry as jest.Mock).mock.calls[0][0]
    expect(row.start_time).toBe('12:00')
    expect(row.end_time).toBe('13:00')
    expect(row.status).toBe('confirmed')
    expect(screen.queryByText(/overlap/i)).not.toBeInTheDocument()
  })
})
