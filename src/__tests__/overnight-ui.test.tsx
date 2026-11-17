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
