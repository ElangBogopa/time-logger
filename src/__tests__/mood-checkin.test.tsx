import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MoodLevel, MOOD_CONFIG, SESSION_MOOD_CONFIG, MOOD_EMOJIS, MOOD_COLORS, getMoodMessage } from '@/lib/types'
import MoodCheckIn from '@/components/MoodCheckIn'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock Math.random to return predictable values for message selection
const mockMathRandom = jest.spyOn(Math, 'random')

describe('MOOD_CONFIG (legacy)', () => {
  it('has all three mood levels defined', () => {
    expect(MOOD_CONFIG.low).toBeDefined()
    expect(MOOD_CONFIG.okay).toBeDefined()
    expect(MOOD_CONFIG.great).toBeDefined()
  })

  it('each mood has emoji, label, and color', () => {
    const moods: MoodLevel[] = ['low', 'okay', 'great']

    moods.forEach(mood => {
      expect(MOOD_CONFIG[mood].emoji).toBeTruthy()
      expect(MOOD_CONFIG[mood].label).toBeTruthy()
      expect(MOOD_CONFIG[mood].color).toBeTruthy()
    })
  })
})

describe('SESSION_MOOD_CONFIG', () => {
  it('has config for all three periods', () => {
    expect(SESSION_MOOD_CONFIG.morning).toBeDefined()
    expect(SESSION_MOOD_CONFIG.afternoon).toBeDefined()
    expect(SESSION_MOOD_CONFIG.evening).toBeDefined()
  })

  it('each period has prompt, labels, and messages', () => {
    const periods = ['morning', 'afternoon', 'evening'] as const

    periods.forEach(period => {
      const config = SESSION_MOOD_CONFIG[period]
      expect(config.prompt).toBeTruthy()
      expect(config.labels.low).toBeTruthy()
      expect(config.labels.okay).toBeTruthy()
      expect(config.labels.great).toBeTruthy()
      expect(config.messages.low.length).toBeGreaterThan(0)
      expect(config.messages.okay.length).toBeGreaterThan(0)
      expect(config.messages.great.length).toBeGreaterThan(0)
    })
  })

  it('morning has session-specific labels', () => {
    expect(SESSION_MOOD_CONFIG.morning.prompt).toBe("How's your morning energy?")
    expect(SESSION_MOOD_CONFIG.morning.labels.low).toBe('Slow start')
    expect(SESSION_MOOD_CONFIG.morning.labels.okay).toBe('Steady')
    expect(SESSION_MOOD_CONFIG.morning.labels.great).toBe('Ready to go')
  })

  it('afternoon has session-specific labels', () => {
    expect(SESSION_MOOD_CONFIG.afternoon.prompt).toBe("How's your afternoon going?")
    expect(SESSION_MOOD_CONFIG.afternoon.labels.low).toBe('Dragging')
    expect(SESSION_MOOD_CONFIG.afternoon.labels.okay).toBe('Cruising')
    expect(SESSION_MOOD_CONFIG.afternoon.labels.great).toBe('On fire')
  })

  it('evening has session-specific labels', () => {
    expect(SESSION_MOOD_CONFIG.evening.prompt).toBe('How did today go?')
    expect(SESSION_MOOD_CONFIG.evening.labels.low).toBe('Drained')
    expect(SESSION_MOOD_CONFIG.evening.labels.okay).toBe('Alright')
    expect(SESSION_MOOD_CONFIG.evening.labels.great).toBe('Great day')
  })
})

describe('getMoodMessage', () => {
  beforeEach(() => {
    mockMathRandom.mockReturnValue(0) // Always return first message
  })

  it('returns a message from the correct period and mood', () => {
    const message = getMoodMessage('morning', 'low')
    expect(SESSION_MOOD_CONFIG.morning.messages.low).toContain(message)
  })

  it('returns different messages for different moods', () => {
    const lowMessage = getMoodMessage('afternoon', 'low')
    const greatMessage = getMoodMessage('afternoon', 'great')
    expect(lowMessage).not.toBe(greatMessage)
  })
})

describe('MOOD_EMOJIS and MOOD_COLORS', () => {
  it('has emojis for all moods', () => {
    expect(MOOD_EMOJIS.low).toBe('😴')
    expect(MOOD_EMOJIS.okay).toBe('😐')
    expect(MOOD_EMOJIS.great).toBe('⚡')
  })

  it('has colors for all moods', () => {
    expect(MOOD_COLORS.low).toBe('text-amber-500')
    expect(MOOD_COLORS.okay).toBe('text-blue-500')
    expect(MOOD_COLORS.great).toBe('text-green-500')
  })
})

describe('MoodCheckIn Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockMathRandom.mockReturnValue(0) // Predictable message selection
  })

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<MoodCheckIn period="morning" />)

    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('renders morning session prompt when no check-in exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkin: null }),
    })

    render(<MoodCheckIn period="morning" />)

    await waitFor(() => {
      expect(screen.getByText("How's your morning energy?")).toBeInTheDocument()
    })

    expect(screen.getByText('Slow start')).toBeInTheDocument()
    expect(screen.getByText('Steady')).toBeInTheDocument()
    expect(screen.getByText('Ready to go')).toBeInTheDocument()
  })

  it('renders collapsed state with motivational message when already checked in', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'morning', mood: 'great', created_at: '' },
      }),
    })

    render(<MoodCheckIn period="morning" />)

    await waitFor(() => {
      // Should show the mood label
      expect(screen.getByText('Ready to go')).toBeInTheDocument()
    })

    // Should show a motivational message (first one since Math.random returns 0)
    expect(screen.getByText(/The future depends on what you do today/)).toBeInTheDocument()

    // Should show tap to change link
    expect(screen.getByText('Tap to change')).toBeInTheDocument()

    // Should NOT show the prompt (it's collapsed)
    expect(screen.queryByText("How's your morning energy?")).not.toBeInTheDocument()
  })

  it('expands to picker when tap to change is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'afternoon', mood: 'okay', created_at: '' },
      }),
    })

    render(<MoodCheckIn period="afternoon" />)

    await waitFor(() => {
      expect(screen.getByText('Cruising')).toBeInTheDocument()
    })

    // Click tap to change
    fireEvent.click(screen.getByText('Tap to change'))

    // Should now show the prompt and all mood options
    await waitFor(() => {
      expect(screen.getByText("How's your afternoon going?")).toBeInTheDocument()
    })

    expect(screen.getByText('Dragging')).toBeInTheDocument()
    expect(screen.getByText('On fire')).toBeInTheDocument()

    // Should show cancel button
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('collapses back when cancel is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'evening', mood: 'low', created_at: '' },
      }),
    })

    render(<MoodCheckIn period="evening" />)

    await waitFor(() => {
      expect(screen.getByText('Drained')).toBeInTheDocument()
    })

    // Expand
    fireEvent.click(screen.getByText('Tap to change'))

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    // Cancel
    fireEvent.click(screen.getByText('Cancel'))

    // Should collapse back to motivational message
    await waitFor(() => {
      expect(screen.getByText('Tap to change')).toBeInTheDocument()
    })

    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('calls API with period when mood is selected', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkin: null }),
    })

    render(<MoodCheckIn period="afternoon" />)

    await waitFor(() => {
      expect(screen.getByText("How's your afternoon going?")).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'afternoon', mood: 'okay', created_at: '' },
      }),
    })

    const okayButton = screen.getByRole('button', { name: 'Cruising' })
    fireEvent.click(okayButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    expect(mockFetch).toHaveBeenLastCalledWith('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: 'okay', period: 'afternoon' }),
    })
  })

  it('shows motivational message after selecting mood', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkin: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'morning', mood: 'great', created_at: '' },
        }),
      })

    render(<MoodCheckIn period="morning" />)

    await waitFor(() => {
      expect(screen.getByText("How's your morning energy?")).toBeInTheDocument()
    })

    const greatButton = screen.getByRole('button', { name: 'Ready to go' })
    fireEvent.click(greatButton)

    // Should collapse and show motivational message
    await waitFor(() => {
      expect(screen.getByText(/The future depends on what you do today/)).toBeInTheDocument()
    })

    expect(screen.getByText('Tap to change')).toBeInTheDocument()
  })

  it('calls onMoodSelected callback when mood is saved', async () => {
    const onMoodSelected = jest.fn()

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkin: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'morning', mood: 'great', created_at: '' },
        }),
      })

    render(<MoodCheckIn period="morning" onMoodSelected={onMoodSelected} />)

    await waitFor(() => {
      expect(screen.getByText("How's your morning energy?")).toBeInTheDocument()
    })

    const greatButton = screen.getByRole('button', { name: 'Ready to go' })
    fireEvent.click(greatButton)

    await waitFor(() => {
      expect(onMoodSelected).toHaveBeenCalledWith('great')
    })
  })

  it('handles API error gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkin: null }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to save' }),
      })

    render(<MoodCheckIn period="morning" />)

    await waitFor(() => {
      expect(screen.getByText("How's your morning energy?")).toBeInTheDocument()
    })

    const lowButton = screen.getByRole('button', { name: 'Slow start' })
    fireEvent.click(lowButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    // Should still show picker (not collapsed) since save failed
    await waitFor(() => {
      expect(screen.getByText("How's your morning energy?")).toBeInTheDocument()
    })
  })

  it('applies custom className', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkin: null }),
    })

    const { container } = render(<MoodCheckIn period="morning" className="custom-class" />)

    await waitFor(() => {
      expect(screen.getByText("How's your morning energy?")).toBeInTheDocument()
    })

    const wrapper = container.firstChild
    expect(wrapper).toHaveClass('custom-class')
  })

  it('fetches with period query parameter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkin: null }),
    })

    render(<MoodCheckIn period="evening" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/mood?period=evening',
        expect.objectContaining({ signal: expect.any(Object) })
      )
    })
  })

  it('shows different messages for different periods', async () => {
    // Morning low message
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkin: { id: '1', user_id: 'user1', date: '2024-01-15', period: 'morning', mood: 'low', created_at: '' },
      }),
    })

    const { unmount } = render(<MoodCheckIn period="morning" />)

    await waitFor(() => {
      expect(screen.getByText(/Be gentle with yourself this morning/)).toBeInTheDocument()
    })

    unmount()

    // Evening low message (different)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkin: { id: '2', user_id: 'user1', date: '2024-01-15', period: 'evening', mood: 'low', created_at: '' },
      }),
    })

    render(<MoodCheckIn period="evening" />)

    await waitFor(() => {
      expect(screen.getByText(/You have survived everything you have been through/)).toBeInTheDocument()
    })
  })
})

describe('MoodLevel type', () => {
  it('only allows valid mood values', () => {
    const validMoods: MoodLevel[] = ['low', 'okay', 'great']

    validMoods.forEach(mood => {
      expect(['low', 'okay', 'great']).toContain(mood)
    })
  })
})
