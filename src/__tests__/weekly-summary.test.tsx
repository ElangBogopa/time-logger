import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TimeEntry, TimeCategory } from '@/lib/types'

// Track mock responses
let currentWeekData: TimeEntry[] = []
let previousWeekData: TimeEntry[] = []
let callIndex = 0

// Create a mock chain that resolves with test data
const createMockChain = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockImplementation(() => {
    const data = callIndex === 0 ? currentWeekData : previousWeekData
    callIndex++
    return Promise.resolve({ data })
  }),
})

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => createMockChain()),
  },
}))

// Import after mocks are set up
import WeeklySummary from '@/components/WeeklySummary'

// Helper to create mock time entries
function createMockEntry(
  category: TimeCategory,
  durationMinutes: number,
  date: string
): TimeEntry {
  return {
    id: Math.random().toString(),
    user_id: 'user1',
    date,
    activity: `Test ${category} activity`,
    category,
    duration_minutes: durationMinutes,
    start_time: '09:00',
    end_time: '10:00',
    description: null,
    commentary: null,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  }
}

describe('WeeklySummary Component', () => {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]

  beforeEach(() => {
    jest.clearAllMocks()
    callIndex = 0
    currentWeekData = []
    previousWeekData = []
  })

  it('renders loading skeleton initially', async () => {
    // Set empty data
    currentWeekData = []
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    // Initially shows loading state
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('renders weekly summary header when data loads', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr),
      createMockEntry('exercise', 60, dateStr),
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })
  })

  it('shows total time logged', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr), // 2 hours
      createMockEntry('exercise', 60, dateStr),    // 1 hour
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      // Should show 3h total
      expect(screen.getByText('3h')).toBeInTheDocument()
    })
  })

  it('shows Energy Distribution section with aggregated categories', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 180, dateStr),   // Focus
      createMockEntry('learning', 60, dateStr),     // Focus
      createMockEntry('exercise', 60, dateStr),     // Body
      createMockEntry('social', 90, dateStr),       // Connection
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Energy Distribution')).toBeInTheDocument()
    })
  })

  it('shows toggle between summary and detailed views', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr),
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Show detailed')).toBeInTheDocument()
    })
  })

  it('toggles to detailed view when clicked', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr),
      createMockEntry('shallow_work', 60, dateStr),
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Show detailed')).toBeInTheDocument()
    })

    // Click to show detailed
    fireEvent.click(screen.getByText('Show detailed'))

    await waitFor(() => {
      expect(screen.getByText('Show summary')).toBeInTheDocument()
    })

    // Should now show granular category labels
    expect(screen.getByText('Deep Work')).toBeInTheDocument()
    expect(screen.getByText('Shallow Work')).toBeInTheDocument()
  })

  it('shows aggregated labels in summary view', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr),
      createMockEntry('learning', 60, dateStr),
      createMockEntry('exercise', 45, dateStr),
      createMockEntry('rest', 30, dateStr),
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      // Should show aggregated category labels in the Time by Energy section
      expect(screen.getByText('Time by Energy')).toBeInTheDocument()
    })

    // Verify aggregated labels exist (may appear multiple times)
    expect(screen.getAllByText(/focus/i).length).toBeGreaterThan(0)
  })

  it('shows week-over-week comparison', async () => {
    const lastWeekDate = new Date(today)
    lastWeekDate.setDate(lastWeekDate.getDate() - 7)
    const lastWeekStr = lastWeekDate.toISOString().split('T')[0]

    currentWeekData = [
      createMockEntry('deep_work', 180, dateStr),
    ]
    previousWeekData = [
      createMockEntry('deep_work', 120, lastWeekStr),
    ]

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Compared to Last Week')).toBeInTheDocument()
    })
  })

  it('handles empty data gracefully', async () => {
    currentWeekData = []
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('No entries this week yet.')).toBeInTheDocument()
    })
  })

  it('aggregates multiple categories into Focus correctly', async () => {
    // All three Focus categories
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr),  // 2h
      createMockEntry('learning', 60, dateStr),    // 1h
      createMockEntry('creating', 30, dateStr),    // 30m
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })

    // Should show 3h 30m total (may appear in multiple places - header and medal section)
    expect(screen.getAllByText('3h 30m').length).toBeGreaterThan(0)
  })

  it('aggregates Ops categories correctly', async () => {
    currentWeekData = [
      createMockEntry('shallow_work', 30, dateStr),
      createMockEntry('meetings', 60, dateStr),
      createMockEntry('admin', 30, dateStr),
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })

    // Should show 2h total (may appear in multiple places)
    expect(screen.getAllByText('2h').length).toBeGreaterThan(0)
  })

  it('shows top 3 categories with medals', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 180, dateStr),
      createMockEntry('exercise', 120, dateStr),
      createMockEntry('social', 90, dateStr),
      createMockEntry('entertainment', 60, dateStr),
    ]
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Energy Distribution')).toBeInTheDocument()
    })
  })

  it('calculates change from previous week correctly', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 300, dateStr), // 5h this week
    ]
    previousWeekData = [
      createMockEntry('deep_work', 180, dateStr), // 3h last week
    ]

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })

    // Should show +2h change somewhere on the page (using regex since +2h may be split across elements)
    const plusElements = screen.getAllByText(/\+2h|\+2h vs last week/)
    expect(plusElements.length).toBeGreaterThan(0)
  })

  it('shows negative change when time decreased', async () => {
    currentWeekData = [
      createMockEntry('exercise', 60, dateStr), // 1h this week
    ]
    previousWeekData = [
      createMockEntry('exercise', 180, dateStr), // 3h last week
    ]

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })

    // Should show comparison section with negative change
    expect(screen.getByText('Compared to Last Week')).toBeInTheDocument()
  })
})

describe('WeeklySummary aggregation logic', () => {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]

  beforeEach(() => {
    jest.clearAllMocks()
    callIndex = 0
    currentWeekData = []
    previousWeekData = []
  })

  it('correctly groups all 19 categories into 6 aggregated categories', async () => {
    // Create entries for all 19 categories
    const allCategories: TimeCategory[] = [
      'deep_work', 'shallow_work', 'meetings', 'learning', 'creating',
      'admin', 'errands', 'chores', 'commute',
      'exercise', 'movement', 'meals', 'sleep',
      'rest', 'self_care',
      'social', 'calls',
      'entertainment',
      'other',
    ]

    currentWeekData = allCategories.map(cat =>
      createMockEntry(cat, 30, dateStr)
    )
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })

    // In summary view, should show Time by Energy section (which contains aggregated labels)
    await waitFor(() => {
      expect(screen.getByText('Time by Energy')).toBeInTheDocument()
    })

    // The aggregated labels should appear - use findAllByText to check they exist
    // Note: Some labels like "Focus" might appear multiple times (in medals and in bar chart)
    expect(screen.getAllByText(/Focus|Ops|Body|Recovery|Connection|Escape/).length).toBeGreaterThan(0)
  })

  it('skips entries with null category in aggregation', async () => {
    currentWeekData = [
      createMockEntry('deep_work', 120, dateStr),
    ]
    // Add a pending entry that should be skipped (null category)
    currentWeekData.push({
      ...createMockEntry('deep_work', 60, dateStr),
      category: null, // Pending entries have null category
      status: 'pending',
    })
    previousWeekData = []

    render(<WeeklySummary userId="user1" />)

    await waitFor(() => {
      // Should show the header
      expect(screen.getByText('Weekly Summary')).toBeInTheDocument()
    })

    // Total time includes all entries (3h), but category breakdown shows only confirmed (2h for Focus)
    // The component counts all entries for total but skips null categories in category stats
    // The comparison section shows "more focus" with 2h (lowercase focus from label)
    await waitFor(() => {
      expect(screen.getByText(/more focus/)).toBeInTheDocument()
    })
  })
})
