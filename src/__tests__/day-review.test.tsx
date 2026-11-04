import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Import after mocks
import DayReviewPage from '@/app/day-review/page'

// Mock day summary response
const createMockDaySummary = (overrides = {}) => ({
  score: 75,
  scoreColor: 'green' as const,
  sessionsLogged: 2,
  totalSessions: 3,
  totalMinutesLogged: 420,
  hasEveningPassed: false,
  date: '2024-01-15',
  targetProgress: [
    {
      targetId: '1',
      targetType: 'deep_focus',
      label: 'Deep Work',
      todayMinutes: 180,
      yesterdayMinutes: 120,
      sameDayLastWeekMinutes: 150,
      dailyTarget: 180,
      weeklyTarget: 1260,
      weekMinutes: 600,
      progress: 100,
      direction: 'at_least' as const,
      trend: 'up' as const,
      vsLastWeekTrend: 'up' as const,
    },
  ],
  wins: [
    { id: 'win1', text: 'Hit your deep work goal', type: 'goal_met' as const, value: 180 },
  ],
  timeline: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    entries: [],
    totalMinutes: 0,
  })),
  longestFocusSession: { activity: 'Coding', minutes: 90 },
  categoryBreakdown: [
    { category: 'deep_work' as const, label: 'Deep Work', minutes: 180, percentage: 43 },
    { category: 'meetings' as const, label: 'Meetings', minutes: 60, percentage: 14 },
    { category: 'exercise' as const, label: 'Exercise', minutes: 45, percentage: 11 },
    { category: 'meals' as const, label: 'Meals', minutes: 60, percentage: 14 },
    { category: 'social' as const, label: 'Social', minutes: 45, percentage: 11 },
    { category: 'entertainment' as const, label: 'Entertainment', minutes: 30, percentage: 7 },
  ],
  aggregatedBreakdown: [
    { category: 'focus' as const, label: 'Focus', minutes: 180, percentage: 43, isTargetLinked: true },
    { category: 'ops' as const, label: 'Ops', minutes: 60, percentage: 14, isTargetLinked: false },
    { category: 'body' as const, label: 'Body', minutes: 105, percentage: 25, isTargetLinked: false },
    { category: 'connection' as const, label: 'Connection', minutes: 45, percentage: 11, isTargetLinked: false },
    { category: 'escape' as const, label: 'Escape', minutes: 30, percentage: 7, isTargetLinked: false },
  ],
  todayMood: null,
  entries: [],
  ...overrides,
})

describe('DayReviewPage', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  }

  /**
   * Routed by URL rather than by call order. The page asks for the review
   * status, the summary, the day's metrics and the commentary; which of
   * them resolves first is not part of its contract, and an ordered queue
   * of mockResolvedValueOnce broke the moment the metrics fetch was added.
   */
  const routeFetch = (
    summary: unknown,
    metrics = { body: 61, focus: 84, social: 42 },
    commentary = 'Test commentary'
  ) =>
    mockFetch.mockImplementation(async (url: unknown) => {
      const target = String(url)
      if (target.includes('/api/day-review')) {
        return { ok: true, json: async () => ({ source: 'live', review: null }) }
      }
      if (target.includes('/api/day-summary')) return { ok: true, json: async () => summary }
      if (target.includes('/api/metrics/trend')) {
        return {
          ok: true,
          json: async () => ({
            body: { current: metrics.body, average: metrics.body },
            focus: { current: metrics.focus, average: metrics.focus },
            social: { current: metrics.social, average: metrics.social },
          }),
        }
      }
      if (target.includes('/api/day-commentary')) {
        return { ok: true, json: async () => ({ commentary }) }
      }
      return { ok: false, json: async () => ({}) }
    })


  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { id: 'user1', email: 'test@test.com' } },
    })
    // Mock useSearchParams
    const mockSearchParams = new URLSearchParams('date=2024-01-15')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
  })

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    ;(useSession as jest.Mock).mockReturnValue({ status: 'loading' })

    render(<DayReviewPage />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('redirects to login if not authenticated', () => {
    ;(useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated' })
    mockFetch.mockImplementation(() => new Promise(() => {}))

    render(<DayReviewPage />)

    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('renders day review page with summary data', async () => {
    routeFetch(createMockDaySummary())

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Day in Review')).toBeInTheDocument()
    })
  })

  it("leads with the day's three metrics, not a logging percentage", async () => {
    // The hero used to be summary.score — sessionsLogged ÷ sessionsPassed,
    // which reads 100 whenever every session has something in it. It is now
    // Body / Mind / Heart for that date, on the same scale as the dashboard.
    routeFetch(createMockDaySummary({ score: 75 }), { body: 61, focus: 84, social: 42 })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('61')).toBeInTheDocument()
    })
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    // the sessions line survives as a caption: a fact, not a score
    expect(screen.getByText(/2\/3 sessions/)).toBeInTheDocument()
    expect(screen.queryByText('75')).not.toBeInTheDocument()
  })

  // The assertions below cover the Energy Breakdown, Category Breakdown, Mood,
  // Wins and AI commentary sections, which are commented out of the page render
  // (see src/app/day-review/page.tsx — "commented out until science-based
  // measurement is ready"). Un-skip these once those sections come back.
  it.skip('displays energy breakdown section with aggregated categories', async () => {
    const mockSummary = createMockDaySummary()

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test commentary' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Energy Breakdown')).toBeInTheDocument()
    })

    // Should show aggregated category labels
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByText('Ops')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Connection')).toBeInTheDocument()
    expect(screen.getByText('Escape')).toBeInTheDocument()
  })

  it.skip('shows target-linked indicator for Focus category', async () => {
    const mockSummary = createMockDaySummary({
      aggregatedBreakdown: [
        { category: 'focus', label: 'Focus', minutes: 180, percentage: 43, isTargetLinked: true },
        { category: 'body', label: 'Body', minutes: 60, percentage: 14, isTargetLinked: false },
      ],
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test commentary' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Focus')).toBeInTheDocument()
    })

    // The Target icon should be rendered for target-linked categories
    // We can check the container has the expected structure
    const focusLabel = screen.getByText('Focus')
    expect(focusLabel).toBeInTheDocument()
  })

  it.skip('displays wins section when wins exist', async () => {
    const mockSummary = createMockDaySummary({
      wins: [
        { id: 'win1', text: 'Hit your deep work goal', type: 'goal_met', value: 180 },
        { id: 'win2', text: '90 min focus session', type: 'focus', value: 90 },
      ],
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test commentary' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText("Today's Wins")).toBeInTheDocument()
    })

    expect(screen.getByText('Hit your deep work goal')).toBeInTheDocument()
    expect(screen.getByText('90 min focus session')).toBeInTheDocument()
  })

  it.skip('displays target progress cards', async () => {
    const mockSummary = createMockDaySummary({
      targetProgress: [
        {
          targetId: '1',
          targetType: 'deep_focus',
          label: 'Deep Work Goal',
          todayMinutes: 180,
          yesterdayMinutes: 120,
          sameDayLastWeekMinutes: 150,
          dailyTarget: 180,
          weeklyTarget: 1260,
          weekMinutes: 600,
          progress: 100,
          direction: 'at_least',
          trend: 'up',
          vsLastWeekTrend: 'up',
        },
        {
          targetId: '2',
          targetType: 'exercise',
          label: 'Exercise Goal',
          todayMinutes: 45,
          yesterdayMinutes: 60,
          sameDayLastWeekMinutes: 30,
          dailyTarget: 30,
          weeklyTarget: 210,
          weekMinutes: 150,
          progress: 150,
          direction: 'at_least',
          trend: 'down',
          vsLastWeekTrend: 'up',
        },
      ],
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test commentary' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Goal Progress')).toBeInTheDocument()
    })

    expect(screen.getByText('Deep Work Goal')).toBeInTheDocument()
    expect(screen.getByText('Exercise Goal')).toBeInTheDocument()
  })

  it.skip('displays longest focus session when significant', async () => {
    const mockSummary = createMockDaySummary({
      longestFocusSession: { activity: 'Writing report', minutes: 90 },
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test commentary' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Longest focus session')).toBeInTheDocument()
    })

    expect(screen.getByText(/90 min on "Writing report"/)).toBeInTheDocument()
  })

  it.skip('does not show longest focus session if under 30 minutes', async () => {
    const mockSummary = createMockDaySummary({
      longestFocusSession: { activity: 'Quick task', minutes: 20 },
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test commentary' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Day in Review')).toBeInTheDocument()
    })

    expect(screen.queryByText('Longest focus session')).not.toBeInTheDocument()
  })

  it.skip('displays AI commentary', async () => {
    const mockSummary = createMockDaySummary()
    const commentary = 'Solid day of focused work. You hit your deep work target and stayed active.'

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText(commentary)).toBeInTheDocument()
    })
  })

  it('handles back button click', async () => {
    routeFetch(createMockDaySummary())

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument()
    })

    // Find and click the back button
    const backButton = screen.getByText('Back')
    backButton.click()

    expect(mockRouter.back).toHaveBeenCalled()
  })

  it.skip('shows error state when API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Unable to load day review')).toBeInTheDocument()
    })
  })

  it.skip('formats minutes correctly', async () => {
    const mockSummary = createMockDaySummary({
      totalMinutesLogged: 135, // 2h 15m
      aggregatedBreakdown: [
        { category: 'focus', label: 'Focus', minutes: 135, percentage: 100, isTargetLinked: false },
      ],
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('2h 15m')).toBeInTheDocument()
    })
  })

  it.skip('shows categories with 0 minutes if target-linked', async () => {
    const mockSummary = createMockDaySummary({
      aggregatedBreakdown: [
        { category: 'focus', label: 'Focus', minutes: 120, percentage: 80, isTargetLinked: true },
        { category: 'body', label: 'Body', minutes: 30, percentage: 20, isTargetLinked: false },
        { category: 'connection', label: 'Connection', minutes: 0, percentage: 0, isTargetLinked: true },
      ],
    })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentary: 'Test' }),
      })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('Focus')).toBeInTheDocument()
      expect(screen.getByText('Body')).toBeInTheDocument()
      // Connection should show even with 0 minutes because it's target-linked
      expect(screen.getByText('Connection')).toBeInTheDocument()
    })
  })
})

// Skipped with the rest of the breakdown assertions above: the score colors
// live in a section currently commented out of the page render.
describe.skip('DayReviewPage score colors', () => {
  const mockRouter = { push: jest.fn(), back: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { id: 'user1' } },
    })
  })

  it('shows green score for 70+', async () => {
    const mockSummary = createMockDaySummary({ score: 85, scoreColor: 'green' })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockSummary })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commentary: 'Test' }) })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument()
    })
  })

  it('shows orange score for 40-69', async () => {
    const mockSummary = createMockDaySummary({ score: 55, scoreColor: 'orange' })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockSummary })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commentary: 'Test' }) })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('55')).toBeInTheDocument()
    })
  })

  it('shows red score for under 40', async () => {
    const mockSummary = createMockDaySummary({ score: 25, scoreColor: 'red' })

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ source: 'live', review: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockSummary })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commentary: 'Test' }) })

    render(<DayReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument()
    })
  })
})
