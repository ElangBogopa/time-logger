import { render, screen, within } from '@testing-library/react'
import type { SessionCompletion } from '@/lib/types'

const mockSessionData = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock('next/dynamic', () => () => () => null)
jest.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ data: { user: { id: 'u1' } }, status: 'authenticated' }),
}))
jest.mock('@/hooks/useDashboardState', () => ({
  useDashboardState: () => ({ showOnboarding: false, setShowOnboarding: jest.fn(), currentHour: 22 }),
}))
jest.mock('@/hooks/useHabitHistory', () => ({ useHabitHistory: () => null }))
jest.mock('@/hooks/useGreeting', () => ({
  useGreeting: () => ({ greeting: { text: 'Hi' }, quotes: {}, currentPeriod: 'evening' }),
}))
jest.mock('@/hooks/useSessionData', () => ({
  useSessionData: (...args: unknown[]) => mockSessionData(...args),
}))
jest.mock('@/components/DashboardHero', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/OnboardingModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/dashboard/GreetingHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/YourPlan', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/NextUp', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/FirstRunCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/DayWindowsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/InstallHint', () => ({ InstallHintCard: () => null }))

import Home from '@/app/page'
function completion(period: SessionCompletion['period'], skipped: boolean): SessionCompletion {
  return {
    id: period, user_id: 'u1', date: '2026-01-01', period,
    completed_at: '2026-01-01T20:00:00Z', entry_count: 0, total_minutes: 0, skipped,
  }
}

describe('Today row for a session answered "Nothing to log"', () => {
  afterEach(() => mockSessionData.mockReset())

  function renderWith(completions: SessionCompletion[]) {
    mockSessionData.mockReturnValue({
      entries: [], completions, isLoading: false, yesterdayEveningLogged: true, fetchData: jest.fn(),
    })
    render(<Home />)
    return screen.getByText('Evening').closest('button') as HTMLElement
  }

  it('says "Nothing to log" and shows the tick', () => {
    const row = renderWith([completion('evening', true)])
    expect(within(row).getByText('Nothing to log')).toBeInTheDocument()
    expect(within(row).getByLabelText('Done')).toBeInTheDocument()
  })

  it('an unanswered row has neither', () => {
    const row = renderWith([])
    expect(within(row).queryByText('Nothing to log')).toBeNull()
    expect(within(row).queryByLabelText('Done')).toBeNull()
  })
})
