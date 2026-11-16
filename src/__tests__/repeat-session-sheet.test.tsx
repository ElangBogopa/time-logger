import { render, screen, fireEvent } from '@testing-library/react'
import RepeatSessionSheet from '@/components/RepeatSessionSheet'
import type { RepeatRow } from '@/lib/repeat-session'
import type { TimeEntry } from '@/lib/types'

const mk = (id: string, activity: string, start: string, end: string, minutes: number): TimeEntry =>
  ({
    id,
    user_id: 'u1',
    date: '2026-11-02',
    activity,
    category: 'deep_work',
    duration_minutes: minutes,
    start_time: start,
    end_time: end,
    status: 'confirmed',
  }) as TimeEntry

const gym = mk('g', 'Gym', '08:00', '09:45', 105)
const rows: RepeatRow[] = [
  { entry: mk('a', 'Emails', '10:00', '10:30', 30), clash: null },
  { entry: mk('b', 'Reading', '10:30', '11:00', 30), clash: null },
  { entry: mk('c', 'Dentist', '09:00', '10:00', 60), clash: gym },
]

function setup() {
  const onLog = jest.fn()
  const onPickTime = jest.fn()
  render(
    <RepeatSessionSheet
      open
      onOpenChange={jest.fn()}
      label="yesterday"
      rows={rows}
      isLogging={false}
      onLog={onLog}
      onPickTime={onPickTime}
    />
  )
  return { onLog, onPickTime }
}

describe('RepeatSessionSheet', () => {
  it('opens with nothing ticked and the button disabled', () => {
    setup()
    const button = screen.getByRole('button', { name: 'Choose what to log' })
    expect(button).toBeDisabled()
  })

  it('logs the two ticked rows with their total', () => {
    const { onLog } = setup()
    fireEvent.click(screen.getByText('Emails'))
    fireEvent.click(screen.getByText('Reading'))
    const button = screen.getByRole('button', { name: 'Log 2 activities · 1h' })
    fireEvent.click(button)
    expect(onLog).toHaveBeenCalledWith(new Set(['a', 'b']))
  })

  it('selects every row but the clashing one, then offers Clear', () => {
    const { onLog } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Log 2 activities/ }))
    expect(onLog).toHaveBeenCalledWith(new Set(['a', 'b']))
  })

  it('sends a clashing row to the add screen', () => {
    const { onPickTime } = setup()
    expect(screen.getByText('Overlaps Gym · pick a time')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Dentist'))
    expect(onPickTime).toHaveBeenCalledWith(rows[2])
  })
})
