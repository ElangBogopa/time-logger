import { render, screen, fireEvent, within } from '@testing-library/react'

global.fetch = jest.fn()
const scrollTo = jest.fn()
Element.prototype.scrollTo = scrollTo

import TimeEntryModal from '@/components/TimeEntryModal'

const entry = {
  id: 'e1', user_id: 'u1', date: '2024-01-15', activity: 'Report', category: 'deep_work',
  status: 'confirmed', duration_minutes: 60, start_time: '06:00', end_time: '07:00',
  description: null, commentary: null, created_at: '2024-01-15T09:00:00Z',
}

it('edits times with the picker, End listing only times after the start', () => {
  render(
    <TimeEntryModal entry={entry as never} onClose={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} onShowToast={jest.fn()} />
  )
  fireEvent.click(screen.getByRole('button', { name: /edit/i }))
  fireEvent.click(screen.getByText('End'))

  const col = screen.getByTestId('time-column-end')
  expect(within(col).queryByText('6:00 AM')).toBeNull()
  let top: number | undefined
  scrollTo.mock.calls.forEach((c, i) => { if (scrollTo.mock.contexts[i] === col) top = c[0].top })
  expect(top).toBe(3 * 48)

  fireEvent.click(within(col).getByText('7:30 AM'))
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
  expect(screen.getByLabelText(/Duration/)).toHaveValue(90)
})
