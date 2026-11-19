/**
 * "Your windows" on Today: what this hour is best for, moved to the wake
 * time the person has stated, with the whole day and its reasons behind a
 * tap. A wake time comes only from what they said (`localStorage['wake-time']`),
 * never from the log.
 */

import { render, screen, fireEvent, within, renderHook } from '@testing-library/react'
import type { HabitEntry } from '@/lib/habits'

let mockHour = 10

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserCurrentHour: () => mockHour,
}))
let mockHistory: HabitEntry[] = []
jest.mock('@/hooks/useHabitHistory', () => ({ useHabitHistory: () => mockHistory }))
jest.mock('@/components/SourceSheet', () => ({
  __esModule: true,
  default: ({ sourceId }: { sourceId: string | null }) => (sourceId ? <div data-testid="source">{sourceId}</div> : null),
}))

import DayWindowsCard from '@/components/DayWindowsCard'
import { useMyWindows } from '@/hooks/useMyWindows'
import { windowsForWake } from '@/lib/ideal-day'

/** Sleep rows saved before sleep was removed, ending at the given time. */
const sleptUntil = (end: string): HabitEntry[] =>
  ['01', '02', '03', '04'].map((d) => ({
    date: `2026-11-${d}`, activity: 'Slept', category: 'sleep', start_time: '00:00', end_time: end, duration_minutes: 420,
  }))

beforeEach(() => {
  localStorage.clear()
  mockHistory = []
  mockHour = 10
  jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
})
afterEach(() => jest.restoreAllMocks())

it('says what this hour is best for, and what comes next', () => {
  render(<DayWindowsCard />)
  expect(screen.getByText('Peak focus')).toBeInTheDocument()
  expect(screen.getByText(/until 12:00 PM/)).toBeInTheDocument()
  expect(screen.getByText(/Peak cognitive hours/)).toBeInTheDocument()
  expect(screen.getByText('Midday, with people')).toBeInTheDocument()
})

it('uses the reference day, and says so, until it knows when you wake', () => {
  render(<DayWindowsCard />)
  expect(screen.getByRole('button', { name: /set when you wake/i })).toBeInTheDocument()
})

it('moves the windows to the wake time you have stated', () => {
  // Up at nine, everything is two and a half hours later: at ten this
  // person is in the morning-movement window, with peak focus still ahead.
  localStorage.setItem('wake-time', String(9 * 60))
  render(<DayWindowsCard />)
  expect(screen.getByRole('button', { name: /up at 9:00 AM/i })).toBeInTheDocument()
  expect(screen.getByText('Morning movement')).toBeInTheDocument()
  expect(screen.getByText(/until 10:30 AM/)).toBeInTheDocument()
  expect(screen.getByText(/Next:/)).toHaveTextContent('Plan and refuel at 10:30 AM')
})

it('lists the whole day with a reason and a source for each window', () => {
  render(<DayWindowsCard />)
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))

  const sheet = screen.getByRole('dialog')
  const rows = within(sheet).getAllByRole('listitem')
  expect(rows).toHaveLength(10)
  expect(within(rows[2]).getByText(/9:00 AM – 12:00 PM/)).toBeInTheDocument()
  expect(within(rows[2]).getByText(/Best for deep work, creating/)).toBeInTheDocument()

  fireEvent.click(within(rows[2]).getByRole('button', { name: 'why?' }))
  expect(screen.getByTestId('source')).toHaveTextContent('circadian')
})

it('a log full of sleep entries does not move the windows and no "From your log" line is shown', () => {
  mockHistory = sleptUntil('09:00')
  render(<DayWindowsCard />)
  expect(screen.getByRole('button', { name: /set when you wake/i })).toBeInTheDocument()
  expect(screen.getByText('Peak focus')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))
  expect(screen.queryByText(/From your log/)).not.toBeInTheDocument()
  expect(screen.getByText(/These are for someone who wakes at 6:30 AM/)).toBeInTheDocument()

  const { result } = renderHook(() => useMyWindows())
  expect(result.current.wakeMinutes).toBeNull()
  expect(result.current.wakeSource).toBe('unknown')
  expect(result.current.windows).toEqual(windowsForWake(null))
})

it('lets you say when you wake, and remembers it', () => {
  const { unmount } = render(<DayWindowsCard />)
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))

  fireEvent.click(screen.getByRole('button', { name: 'Set my wake time' }))
  fireEvent.change(screen.getByLabelText('When you wake'), { target: { value: '05:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(screen.getByText(/Set for waking at 5:00 AM/)).toBeInTheDocument()
  // Peak focus is now 7:30–10:30.
  expect(screen.getByText(/7:30 AM – 10:30 AM/)).toBeInTheDocument()

  unmount()
  render(<DayWindowsCard />)
  expect(screen.getByRole('button', { name: /up at 5:00 AM/i })).toBeInTheDocument()
})

it('can clear a stated wake time, back to the reference day', () => {
  localStorage.setItem('wake-time', String(5 * 60))
  render(<DayWindowsCard />)
  fireEvent.click(screen.getByRole('button', { name: /see all of today/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByText(/These are for someone who wakes at 6:30 AM/)).toBeInTheDocument()
  expect(localStorage.getItem('wake-time')).toBeNull()
})

it('says when the day’s windows are over', () => {
  mockHour = 23
  render(<DayWindowsCard />)
  expect(screen.getByText(/windows are behind you/)).toBeInTheDocument()
})
