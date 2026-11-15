import { render, screen, fireEvent, waitFor } from '@testing-library/react'

Element.prototype.scrollTo = jest.fn()

jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  createEntry: jest.fn(async (row: Record<string, unknown>) => ({ id: 'new', ...row })),
  updateEntry: jest.fn(async () => ({})),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({ category: 'chores' }) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getRealToday: () => '2026-11-03',
}))

import QuickLogModal from '@/components/QuickLogModal'
import { createEntry, csrfFetch } from '@/lib/api'

const categorizeCalls = () =>
  (csrfFetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/categorize')

describe('QuickLogModal with a known category', () => {
  beforeEach(() => jest.clearAllMocks())

  it('skips /api/categorize while the prefilled name is unchanged', async () => {
    render(
      <QuickLogModal isOpen onClose={jest.fn()} onEntryAdded={jest.fn()} selectedDate="2026-11-03" isPastDay userId="u1" lastEntryEndTime={null}
        disablePostSubmit initialStartTime="09:00" initialEndTime="10:00" initialName="Dentist" knownCategory="self_care" />
    )
    const input = screen.getByDisplayValue('Dentist')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(createEntry).toHaveBeenCalled())
    expect(categorizeCalls()).toHaveLength(0)
    expect((createEntry as jest.Mock).mock.calls[0][0].category).toBe('self_care')
  })

  it('asks /api/categorize once the name is retyped', async () => {
    render(
      <QuickLogModal isOpen onClose={jest.fn()} onEntryAdded={jest.fn()} selectedDate="2026-11-03" isPastDay userId="u1" lastEntryEndTime={null}
        disablePostSubmit initialStartTime="09:00" initialEndTime="10:00" initialName="Dentist" knownCategory="self_care" />
    )
    const input = screen.getByDisplayValue('Dentist')
    fireEvent.change(input, { target: { value: 'Cleaning the flat' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(createEntry).toHaveBeenCalled())
    expect(categorizeCalls()).toHaveLength(1)
    expect((createEntry as jest.Mock).mock.calls[0][0].category).toBe('chores')
  })
})
