/**
 * The screens' side of entries across midnight: an overnight entry is not
 * dragged, the edit form's sleep hint and its refusal to save, the glance
 * and the timeline placing a night by the part on its own date, and the
 * neighbouring night's spill.
 */
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react'

Element.prototype.scrollTo = jest.fn()

let categorizeResult: { ok: boolean; category?: string } = { ok: true, category: 'sleep' }

jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  updateEntry: jest.fn(async () => ({})),
  deleteEntry: jest.fn(async () => ({})),
  csrfFetch: jest.fn(async () => ({
    ok: categorizeResult.ok,
    json: async () => ({ category: categorizeResult.category }),
  })),
}))

import TimeEntryModal from '@/components/TimeEntryModal'
import { blocksForGlance } from '@/components/DayAtAGlance'
import { useEntryAdjustment } from '@/hooks/useEntryAdjustment'
import { useOvernightSpill } from '@/hooks/useOvernightSpill'
import { useTimelineData } from '@/hooks/useTimelineData'
import { fetchEntries, updateEntry } from '@/lib/api'

const night = {
  id: 'n1', user_id: 'u1', date: '2026-11-17', activity: 'Night in', category: null,
  status: 'pending', duration_minutes: 480, start_time: '23:00', end_time: '07:00',
  description: null, commentary: null, created_at: '2026-11-16T09:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  categorizeResult = { ok: true, category: 'sleep' }
})

function saveNight() {
  render(
    <TimeEntryModal entry={night as never} onClose={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} onShowToast={jest.fn()} />
  )
  fireEvent.click(screen.getByRole('button', { name: /edit/i }))
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
}

describe('the edit form with a planned night', () => {
  it('tells the server it is a sleep when the categoriser says so', async () => {
    saveNight()
    await waitFor(() => expect(updateEntry).toHaveBeenCalled())
    expect((updateEntry as jest.Mock).mock.calls[0][1]).toMatchObject({ overnight_sleep: true })
  })

  it('tells the server it is not, when the categoriser says another thing', async () => {
    categorizeResult = { ok: true, category: 'meals' }
    saveNight()
    await waitFor(() => expect(updateEntry).toHaveBeenCalled())
    expect((updateEntry as jest.Mock).mock.calls[0][1]).toMatchObject({ overnight_sleep: false })
  })

  it('does not save when the categoriser fails', async () => {
    categorizeResult = { ok: false }
    saveNight()
    await screen.findByText(/failed to categorize/i)
    expect(updateEntry).not.toHaveBeenCalled()
  })
})

describe('a drag on an overnight entry', () => {
  const placed = (start: string, end: string) => ({
    ...night, start_time: start, end_time: end, placedStartTime: '00:00', placedEndTime: '07:00',
    isEstimated: false,
  })
  const press = (entry: ReturnType<typeof placed>) => {
    const { result } = renderHook(() =>
      useEntryAdjustment({
        scrollContainerRef: { current: null as unknown as HTMLDivElement },
        startHour: 0,
        onEntryDeleted: jest.fn(),
        yToTime: () => '01:00',
        onEntryClick: jest.fn(),
      })
    )
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ top: 0, height: 100 } as DOMRect)
    act(() => {
      result.current.handleEntryMouseDown(
        { button: 0, clientY: 95, stopPropagation: jest.fn(), currentTarget: el } as never,
        entry as never
      )
    })
    return result.current
  }

  it('starts for an ordinary entry at its bottom edge', () => {
    expect(press(placed('06:00', '07:00')).isAdjustingEntry).toBe(true)
  })

  it('never starts for one that crosses midnight', () => {
    expect(press(placed('23:00', '07:00')).isAdjustingEntry).toBe(false)
  })
})

describe('a touch on an overnight entry', () => {
  const placed = (start: string, end: string) => ({
    ...night, start_time: start, end_time: end, placedStartTime: '00:00', placedEndTime: '07:00',
    isEstimated: false,
  })
  // A finger held still on the entry: at its bottom edge (a resize) or in
  // its middle (a move, after the longer hold).
  const hold = (entry: ReturnType<typeof placed>, clientY: number) => {
    jest.useFakeTimers()
    const { result, unmount } = renderHook(() =>
      useEntryAdjustment({
        scrollContainerRef: { current: null as unknown as HTMLDivElement },
        startHour: 0,
        onEntryDeleted: jest.fn(),
        yToTime: () => '01:00',
        onEntryClick: jest.fn(),
      })
    )
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ top: 0, height: 100 } as DOMRect)
    act(() => {
      result.current.handleEntryTouchStart(
        { touches: [{ clientY }], stopPropagation: jest.fn(), currentTarget: el } as never,
        entry as never
      )
    })
    const touchActive = result.current.isEntryTouchActive
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    const after = { touchActive, adjusting: result.current.isAdjustingEntry, preview: result.current.adjustPreview }
    unmount()
    return after
  }

  afterEach(() => {
    jest.useRealTimers()
  })

  it('starts a resize for an ordinary entry held at its bottom edge', () => {
    expect(hold(placed('06:00', '07:00'), 95)).toMatchObject({ touchActive: true, adjusting: true })
  })

  it('starts a move for an ordinary entry held in its middle', () => {
    expect(hold(placed('06:00', '07:00'), 40)).toMatchObject({ touchActive: true, adjusting: true })
  })

  it('never starts a resize or a move for one that crosses midnight', () => {
    expect(hold(placed('23:00', '07:00'), 95)).toEqual({ touchActive: false, adjusting: false, preview: null })
    expect(hold(placed('23:00', '07:00'), 40)).toEqual({ touchActive: false, adjusting: false, preview: null })
  })
})

describe('the timeline\'s own placing', () => {
  const confirmed = (over: Record<string, unknown>) => ({ ...night, status: 'confirmed', category: 'sleep', ...over })
  const timeline = (entries: unknown[], covered?: unknown[]) =>
    renderHook(() =>
      useTimelineData({
        entries: entries as never,
        calendarEvents: [],
        dismissedEventIds: new Set<string>(),
        showDismissed: false,
        isToday: false,
        covered: covered as never,
      })
    ).result.current

  it('places a 23:00-07:00 night at 00:00-07:00 on its date', () => {
    const { placedEntries } = timeline([confirmed({})])
    expect(placedEntries).toHaveLength(1)
    expect(placedEntries[0]).toMatchObject({ placedStartTime: '00:00', placedEndTime: '07:00', isEstimated: false })
  })

  it('places a night that is mostly evening from its start to midnight', () => {
    const { placedEntries } = timeline([confirmed({ start_time: '18:00', end_time: '01:00' })])
    expect(placedEntries[0]).toMatchObject({ placedStartTime: '18:00', placedEndTime: '24:00' })
  })

  it('fits an entry without times after the night, not inside it', () => {
    const untimed = confirmed({ id: 'u', activity: 'Breakfast', category: 'meals', start_time: null, end_time: null, duration_minutes: 60 })
    const { placedEntries } = timeline([confirmed({}), untimed])
    expect(placedEntries.find((p) => p.id === 'u')).toMatchObject({
      placedStartTime: '07:00', placedEndTime: '08:00', isEstimated: true,
    })
  })

  it('finds the gap after the night, where it sits on the day', () => {
    const lunch = confirmed({ id: 'l', activity: 'Lunch', category: 'meals', start_time: '12:00', end_time: '13:00', duration_minutes: 60 })
    const { timeGaps } = timeline([confirmed({}), lunch])
    expect(timeGaps.map((g) => [g.startTime, g.endTime])).toEqual([['07:00', '12:00']])
  })

  it('treats a neighbouring night\'s spill as occupied', () => {
    const desk = confirmed({ id: 'd', activity: 'Desk', category: 'deep_work', start_time: '09:00', end_time: '10:00', duration_minutes: 60 })
    const spill = { entryId: 's', activity: 'Sleep', category: 'sleep', startTime: '00:00', endTime: '07:30', homeDate: '2026-11-16' }

    expect(timeline([desk]).timeGaps.map((g) => [g.startTime, g.endTime])).toEqual([['07:00', '09:00']])
    expect(timeline([desk], [spill]).timeGaps.map((g) => [g.startTime, g.endTime])).toEqual([['07:30', '09:00']])
  })

  it('leaves no gap where the spill covers all of it', () => {
    const desk = confirmed({ id: 'd', activity: 'Desk', category: 'deep_work', start_time: '09:00', end_time: '10:00', duration_minutes: 60 })
    const spill = { entryId: 's', activity: 'Sleep', category: 'sleep', startTime: '00:00', endTime: '09:00', homeDate: '2026-11-16' }
    expect(timeline([desk], [spill]).timeGaps).toEqual([])
  })
})

describe('the day at a glance', () => {
  it('draws a night on the part that sits on its own date', () => {
    const wake = blocksForGlance({ entries: [night as never] })
    expect(wake).toHaveLength(1)
    expect([wake[0].startMinutes, wake[0].endMinutes]).toEqual([0, 420])

    const evening = { ...night, id: 'n2', start_time: '18:00', end_time: '01:00' }
    const start = blocksForGlance({ entries: [evening as never] })
    expect([start[0].startMinutes, start[0].endMinutes]).toEqual([1080, 1440])
  })

  it('draws the neighbour\'s spill in its own colour', () => {
    const blocks = blocksForGlance({
      entries: [],
      covered: [{ entryId: 's', activity: 'Sleep', category: 'sleep', startTime: '22:00', endTime: '24:00', homeDate: '2026-11-17' }],
    })
    expect(blocks.map((b) => [b.startMinutes, b.endMinutes])).toEqual([[1320, 1440]])
  })
})

describe('useOvernightSpill', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 's1', date: '2026-11-17', activity: 'Sleep', category: 'sleep', start_time: '23:00',
    end_time: '07:00', status: 'confirmed', ...over,
  })

  it('shows the evening of the next day\'s wake-day sleep, and asks for the three days', async () => {
    ;(fetchEntries as jest.Mock).mockResolvedValue([row({})])
    const { result } = renderHook(() => useOvernightSpill('2026-11-16'))
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0]).toMatchObject({ startTime: '23:00', endTime: '24:00', homeDate: '2026-11-17' })
    expect(fetchEntries).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: '2026-11-15', dateTo: '2026-11-17' })
    )
  })

  it('shows nothing for a night on its own date', async () => {
    ;(fetchEntries as jest.Mock).mockResolvedValue([row({})])
    const { result } = renderHook(() => useOvernightSpill('2026-11-17'))
    await waitFor(() => expect(fetchEntries).toHaveBeenCalled())
    expect(result.current).toHaveLength(0)
  })

  it('answers from the cache at once, and survives a failed lookup', async () => {
    sessionStorage.setItem('overnight-spill:2026-11-16', JSON.stringify({ rows: [row({})] }))
    ;(fetchEntries as jest.Mock).mockRejectedValue(new Error('offline'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useOvernightSpill('2026-11-16'))
    expect(result.current).toHaveLength(1)
    await waitFor(() => expect(fetchEntries).toHaveBeenCalled())
    expect(result.current).toHaveLength(1)
  })
})
