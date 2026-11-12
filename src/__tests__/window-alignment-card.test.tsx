/**
 * The alignment card: time inside the windows, as time. No score.
 */

import { render, screen } from '@testing-library/react'
import WindowAlignmentCard from '@/components/WindowAlignmentCard'
import type { AlignmentFact } from '@/lib/window-alignment'

const facts: AlignmentFact[] = [
  { key: 'focus', label: 'Focused work', bucket: 'focus', totalMinutes: 210, inWindowMinutes: 150 },
  { key: 'movement', label: 'Exercise', bucket: 'body', totalMinutes: 60, inWindowMinutes: 0 },
]

it('states each as time inside out of time done', () => {
  render(<WindowAlignmentCard facts={facts} />)
  expect(screen.getByText('Focused work')).toBeInTheDocument()
  expect(screen.getByText('2h 30m')).toBeInTheDocument()
  expect(screen.getByText(/of 3h 30m/)).toBeInTheDocument()
  expect(screen.getByText(/of 1h/)).toBeInTheDocument()
})

it('describes the bar for someone who cannot see it', () => {
  render(<WindowAlignmentCard facts={facts} />)
  expect(screen.getByRole('img', { name: '71 percent of focused work inside your windows' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '0 percent of exercise inside your windows' })).toBeInTheDocument()
})

it('says it is a guide and not a mark', () => {
  render(<WindowAlignmentCard facts={facts} />)
  expect(screen.getByText(/A guide, not a mark/)).toBeInTheDocument()
})

it('can lead with a sentence, under its own heading', () => {
  render(<WindowAlignmentCard facts={facts} heading="In your windows this week" lead="71% of your focused work fell inside your focus windows." />)
  expect(screen.getByRole('heading', { name: 'In your windows this week' })).toBeInTheDocument()
  expect(screen.getByText(/71% of your focused work/)).toBeInTheDocument()
})

it('is not there when there is nothing to report', () => {
  const { container } = render(<WindowAlignmentCard facts={[]} />)
  expect(container).toBeEmptyDOMElement()
})
