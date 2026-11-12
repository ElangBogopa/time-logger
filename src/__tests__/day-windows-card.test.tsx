/**
 * "Your windows" on Today: what this hour is best for, moved to when the
 * person wakes, with the whole day and its reasons behind a tap.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import type { HabitEntry } from '@/lib/habits'

let mockHour = 10

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserCurrentHour: () => mockHour,
}))
jest.mock('@/components/SourceSheet', () => ({
  __esModule: true,
  default: ({ sourceId }: { sourceId: string | null }) => (sourceId ? <div data-testid="source">{sourceId}</div> : null),
}))

import DayWindowsCard from '@/components/DayWindowsCard'

/** Mornings ending at the given time, enough of them to count as a habit. */
const sleptUntil = (end: string): HabitEntry[] =>
  ['01', '02', '03', '04'].map((d) => ({
    date: `2026-11-${d}`, activity: 'Slept', category: 'sleep', start_time: '00:00', end_time: end, duration_minutes: 420,
  }))

beforeEach(() => {
  localStorage.clear()
  mockHour = 10
  jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
})
afterEach(() => jest.restoreAllMocks())

it('says what this hour is best for, and what comes next', () => {
  render(<DayWindowsCard history={[]} />)
  expect(screen.getByText('Peak focus')).toBeInTheDocument()
  expect(screen.getByText(/until 12:00 PM/)).toBeInTheDocument()
  expect(screen.getByText(/Peak cognitive hours/)).toBeInTheDocument()
  expect(screen.getByText('Midday, with people')).toBeInTheDocument()
})

it('uses the reference day, and says so, until it knows when you wake', () => {
  render(<DayWindowsCard history={[]} />)
  expect(screen.getByRole('button', { name: /set when you wake/i })).toBeInTheDocument()
})

it('moves the windows to when the log says you wake', () => {
  // Up at nine, everything is two and a half hours later: at ten this
  // person is in the morning-movement window, with peak focus still ahead.
  render(<DayWindowsCard history={sleptUntil('09:00')} />)
  expect(screen.getByRole('button', { name: /up at 9:00 AM/i })).toBeInTheDocument()
  expect(screen.getByText('Morning movement')).toBeInTheDocument()
  expect(screen.getByText(/until 10:30 AM/)).toBeInTheDocument()
  expect(screen.getByText(/Next:/)).toHaveTextContent('Plan and refuel at 10:30 AM')
})

it('lists the whole day with a reason and a source for each window', () => {
  render(<DayWindowsCard history={[]} />)
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))

  const sheet = screen.getByRole('dialog')
  const rows = within(sheet).getAllByRole('listitem')
  expect(rows).toHaveLength(10)
  expect(within(rows[2]).getByText(/9:00 AM – 12:00 PM/)).toBeInTheDocument()
  expect(within(rows[2]).getByText(/Best for deep work, creating/)).toBeInTheDocument()

  fireEvent.click(within(rows[2]).getByRole('button', { name: 'why?' }))
  expect(screen.getByTestId('source')).toHaveTextContent('circadian')
})

it('lets you say when you wake, which wins over the log and is remembered', () => {
  const { unmount } = render(<DayWindowsCard history={sleptUntil('09:00')} />)
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))
  expect(screen.getByText(/From your log: you usually wake around 9:00 AM/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Change' }))
  fireEvent.change(screen.getByLabelText('When you wake'), { target: { value: '05:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(screen.getByText(/Set for waking at 5:00 AM/)).toBeInTheDocument()
  // Peak focus is now 7:30–10:30.
  expect(screen.getByText(/7:30 AM – 10:30 AM/)).toBeInTheDocument()

  unmount()
  render(<DayWindowsCard history={sleptUntil('09:00')} />)
  expect(screen.getByRole('button', { name: /up at 5:00 AM/i })).toBeInTheDocument()
})

it('can go back to the log', () => {
  localStorage.setItem('wake-time', String(5 * 60))
  render(<DayWindowsCard history={sleptUntil('09:00')} />)
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))
  fireEvent.click(screen.getByRole('button', { name: /use my log instead/i }))
  expect(screen.getByText(/From your log: you usually wake around 9:00 AM/)).toBeInTheDocument()
})

it('says when the day’s windows are over', () => {
  mockHour = 23
  render(<DayWindowsCard history={[]} />)
  expect(screen.getByText(/windows are behind you/)).toBeInTheDocument()
})
