import React from 'react'
import { render } from '@testing-library/react'

global.fetch = jest.fn()

import TimeEntryModal from '@/components/TimeEntryModal'

const LINE = 'Also counted toward Heart, as time with friends or family.'

const base = {
  id: 'e1',
  user_id: 'u1',
  date: '2024-01-15',
  duration_minutes: 60,
  start_time: '19:00',
  end_time: '20:00',
  description: null,
  commentary: null,
  created_at: '2024-01-15T09:00:00Z',
}

const show = (entry: object) =>
  render(
    <TimeEntryModal
      entry={entry as never}
      onClose={jest.fn()}
      onUpdate={jest.fn()}
      onDelete={jest.fn()}
      onShowToast={jest.fn()}
    />
  )

describe('the Heart line on an entry', () => {
  it('shows for a confirmed entertainment entry with friends', () => {
    const { queryByText } = show({ ...base, activity: 'Video games with friends', category: 'entertainment', status: 'confirmed' })
    expect(queryByText(LINE)).not.toBeNull()
  })
  it('is absent for a bare name', () => {
    const { queryByText } = show({ ...base, activity: 'Gym with Thabo', category: 'exercise', status: 'confirmed' })
    expect(queryByText(LINE)).toBeNull()
  })
  it('is absent for a social entry', () => {
    const { queryByText } = show({ ...base, activity: 'Dinner with family', category: 'social', status: 'confirmed' })
    expect(queryByText(LINE)).toBeNull()
  })
  it('is absent for a pending entry', () => {
    const { queryByText } = show({ ...base, activity: 'Video games with friends', category: null, status: 'pending' })
    expect(queryByText(LINE)).toBeNull()
  })
})
