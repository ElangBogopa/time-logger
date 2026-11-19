/** The session sheet: chips that add up to the total, no MVP, no chat, above the tab bar. */
import { render, screen, act } from '@testing-library/react'
import PeriodSummaryPopup from '@/components/PeriodSummaryPopup'

jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn(async () => []) }))

const row = (id: string, activity: string, category: string, start: string, end: string, minutes: number) => ({
  id, user_id: 'u', date: '2026-11-17', activity, category, status: 'confirmed',
  duration_minutes: minutes, start_time: start, end_time: end, description: null,
  commentary: null, created_at: '2026-11-17T08:00:00Z',
})

it('shows a chip for every category, the total, and neither MVP nor a thread', () => {
  jest.useFakeTimers()
  render(
    <PeriodSummaryPopup
      isOpen
      onClose={jest.fn()}
      period="morning"
      entries={[
        row('a', 'Essay', 'deep_work', '08:00', '09:00', 60),
        row('b', 'Breakfast', 'meals', '09:00', '09:30', 30),
        row('c', 'Call', 'calls', '09:30', '09:50', 20),
        row('d', 'Dishes', 'chores', '09:50', '10:00', 10),
      ] as never}
      commentary="A steady morning."
      isLoading={false}
      isEvening={false}
    />
  )
  act(() => { jest.runAllTimers() })
  for (const label of ['Deep Work', 'Meals', 'Calls', 'Chores']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.getByText('2h 0m')).toBeInTheDocument()
  expect(screen.queryByText('Session MVP')).not.toBeInTheDocument()
  expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()
  expect(screen.getByTestId('period-summary-sheet').className).toContain('z-[60]')
  jest.useRealTimers()
})
