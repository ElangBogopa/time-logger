/** An old link to a goal lands on Today, not on an error. */

import { redirect } from 'next/navigation'

jest.mock('next/navigation', () => ({ redirect: jest.fn() }))

import GoalPage from '@/app/goal/[id]/page'

it('sends a goal link to Today', () => {
  GoalPage()
  expect(redirect).toHaveBeenCalledWith('/')
})
