/**
 * The add sheet with times that cross midnight. On today they can mean two
 * days, so the sheet asks which — "Did this start yesterday?" for anything
 * whose start is still ahead, "Is this tonight's sleep?" for a night typed
 * in the evening — and otherwise saves on the day it is on. The category is
 * fetched exactly once, also for a plan, to tell sleep from the rest.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

Element.prototype.scrollTo = jest.fn()

let category = 'meals'

jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  createEntry: jest.fn(async (row: Record<string, unknown>) => ({ id: 'new', ...row })),
  updateEntry: jest.fn(async () => ({})),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({ category }) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-17',
  getRealToday: () => '2026-11-17',
}))

import QuickLogModal from '@/components/QuickLogModal'
import { createEntry, csrfFetch } from '@/lib/api'

const categorizeCalls = () =>
  (csrfFetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/categorize').length

function open(activity: string, start: string, end: string) {
  const onClose = jest.fn()
  render(
    <QuickLogModal
      isOpen
      onClose={onClose}
      onEntryAdded={jest.fn()}
      selectedDate="2026-11-17"
      userId="u1"
      lastEntryEndTime={null}
      disablePostSubmit
      initialStartTime={start}
      initialEndTime={end}
    />
  )
  const input = document.getElementById('quick-activity') as HTMLInputElement
  fireEvent.change(input, { target: { value: activity } })
  fireEvent.submit(input.closest('form')!)
  return { onClose }
}

const posted = () => (createEntry as jest.Mock).mock.calls[0][0]

function at(hour: number) {
  jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour)
  jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
}

beforeEach(() => {
  jest.clearAllMocks()
  category = 'meals'
})
afterEach(() => jest.restoreAllMocks())

describe('a dinner 23:00–01:00 typed on today in the morning', () => {
  beforeEach(() => at(8))

  it('asks "Did this start yesterday?"', async () => {
    open('Dinner', '23:00', '01:00')
    expect(await screen.findByText('Did this start yesterday?')).toBeInTheDocument()
    expect(createEntry).not.toHaveBeenCalled()
    expect(categorizeCalls()).toBe(1)
  })

  it('Yes posts yesterday as confirmed with the category', async () => {
    open('Dinner', '23:00', '01:00')
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(posted()).toMatchObject({ date: '2026-11-16', status: 'confirmed', category: 'meals', start_time: '23:00', end_time: '01:00' })
    expect(categorizeCalls()).toBe(1)
  })

  it('"No, it\'s tonight" posts today as pending with no category', async () => {
    open('Dinner', '23:00', '01:00')
    fireEvent.click(await screen.findByRole('button', { name: "No, it's tonight" }))
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(posted()).toMatchObject({ date: '2026-11-17', status: 'pending', category: null })
    expect(posted()).not.toHaveProperty('overnight_sleep')
    expect(categorizeCalls()).toBe(1)
  })
})

describe('a sleep 23:00–07:00 typed on today', () => {
  beforeEach(() => {
    category = 'sleep'
  })

  it('in the morning asks nothing and posts confirmed sleep on today', async () => {
    at(8)
    open('Sleep', '23:00', '07:00')
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(posted()).toMatchObject({ date: '2026-11-17', status: 'confirmed', category: 'sleep' })
    expect(screen.queryByText("Is this tonight's sleep?")).not.toBeInTheDocument()
    expect(categorizeCalls()).toBe(1)
  })

  it('in the evening asks "Is this tonight\'s sleep?" and Yes plans it on tomorrow', async () => {
    at(20)
    open('Sleep', '23:00', '07:00')
    expect(await screen.findByText("Is this tonight's sleep?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(posted()).toMatchObject({ date: '2026-11-18', status: 'pending', category: null, overnight_sleep: true })
    expect(categorizeCalls()).toBe(1)
  })

  it('in the evening, "No, last night\'s" posts confirmed sleep on today', async () => {
    at(20)
    open('Sleep', '23:00', '07:00')
    fireEvent.click(await screen.findByRole('button', { name: "No, last night's" }))
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(posted()).toMatchObject({ date: '2026-11-17', status: 'confirmed', category: 'sleep' })
    expect(categorizeCalls()).toBe(1)
  })
})

describe('an entry inside one day', () => {
  it('saves as before, without a question', async () => {
    at(15)
    open('Lunch', '12:00', '13:00')
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
    expect(posted()).toMatchObject({ date: '2026-11-17', status: 'confirmed', category: 'meals', start_time: '12:00', end_time: '13:00' })
    expect(screen.queryByText('Did this start yesterday?')).not.toBeInTheDocument()
  })
})
