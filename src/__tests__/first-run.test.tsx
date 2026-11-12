/**
 * The first trip round the loop: three things to do, ticked as they happen,
 * and never shown to anyone who was here before it existed.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { readFirstRun, startFirstRun, markFirstRun, dismissFirstRun } from '@/lib/first-run'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getUserCurrentHour: () => 10,
}))

import FirstRunCard from '@/components/FirstRunCard'

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

describe('first-run state', () => {
  it('is nothing until onboarding starts it', () => {
    expect(readFirstRun()).toEqual({ started: false, planned: false, reviewed: false, dismissed: false })
  })

  it('ignores marks from anyone who never started', () => {
    // Someone using the app before this existed: reading a review must not conjure the list.
    markFirstRun('reviewed')
    expect(readFirstRun().reviewed).toBe(false)
    expect(localStorage.getItem('first-run')).toBeNull()
  })

  it('records each step once started', () => {
    startFirstRun()
    markFirstRun('planned')
    markFirstRun('reviewed')
    expect(readFirstRun()).toMatchObject({ started: true, planned: true, reviewed: true })
  })

  it('survives a corrupted value', () => {
    localStorage.setItem('first-run', '{not json')
    expect(readFirstRun().started).toBe(false)
  })
})

describe('FirstRunCard', () => {
  it('is not there for someone who did not onboard on this device', () => {
    const { container } = render(<FirstRunCard hasLoggedToday={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the loop, with what is done ticked', () => {
    startFirstRun()
    markFirstRun('planned')
    render(<FirstRunCard hasLoggedToday={false} />)

    expect(screen.getByText('Getting started')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Done')).toHaveLength(1)
    expect(screen.getAllByLabelText('Not done yet')).toHaveLength(2)
  })

  it('takes each step to the place it names', () => {
    startFirstRun()
    render(<FirstRunCard hasLoggedToday={false} />)

    fireEvent.click(screen.getByText('Give something a time'))
    expect(push).toHaveBeenLastCalledWith('/calendar?date=2026-11-03')
    fireEvent.click(screen.getByText('Log what you did'))
    expect(push).toHaveBeenLastCalledWith('/log/morning')
    fireEvent.click(screen.getByText('Read your first review'))
    expect(push).toHaveBeenLastCalledWith('/review')
  })

  it('says so when the loop is closed, and can be put away', () => {
    startFirstRun()
    markFirstRun('planned')
    markFirstRun('reviewed')
    const { container } = render(<FirstRunCard hasLoggedToday />)

    expect(screen.getByText('That is the whole loop')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/You have been round once/))
    expect(container).toBeEmptyDOMElement()
    expect(readFirstRun().dismissed).toBe(true)
  })

  it('can be hidden at any point', () => {
    startFirstRun()
    const { container } = render(<FirstRunCard hasLoggedToday={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide getting started' }))
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden once dismissed', () => {
    startFirstRun()
    dismissFirstRun()
    const { container } = render(<FirstRunCard hasLoggedToday={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
