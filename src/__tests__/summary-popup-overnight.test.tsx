/** The Morning summary counts an older one-piece night of 23:00-07:00 (a Morning entry elsewhere). */
import { render, screen, act } from '@testing-library/react'
import PeriodSummaryPopup from '@/components/PeriodSummaryPopup'

jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn(async () => []) }))

const row = (id: string, activity: string, category: string, start: string, end: string, minutes: number) => ({
  id, user_id: 'u', date: '2026-11-17', activity, category, status: 'confirmed',
  duration_minutes: minutes, start_time: start, end_time: end, description: null,
  commentary: null, created_at: '2026-11-17T08:00:00Z',
})

it('counts the night and the breakfast', () => {
  jest.useFakeTimers()
  render(
    <PeriodSummaryPopup
      isOpen
      onClose={jest.fn()}
      period="morning"
      entries={[
        row('a', 'Sleep', 'sleep', '23:00', '07:00', 480),
        row('b', 'Breakfast', 'meals', '07:30', '08:00', 30),
      ] as never}
      commentary={null}
      isLoading={false}
      isEvening={false}
    />
  )
  act(() => { jest.runAllTimers() })
  expect(screen.getByText(/2 activities logged/)).toBeInTheDocument()
  jest.useRealTimers()
})
