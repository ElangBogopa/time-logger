import { render, screen, fireEvent, within } from '@testing-library/react'
import TimeRangePicker from '@/components/TimeRangePicker'

const scrollTo = jest.fn()
Element.prototype.scrollTo = scrollTo

function open(start: string, end: string) {
  const onEnd = jest.fn()
  render(
    <TimeRangePicker startTime={start} endTime={end} onStartTimeChange={jest.fn()} onEndTimeChange={onEnd} />
  )
  fireEvent.click(screen.getByText('End'))
  const col = screen.getByTestId('time-column-end')
  return { col, onEnd }
}

function lastTopFor(col: HTMLElement): number | undefined {
  let top: number | undefined
  scrollTo.mock.calls.forEach((call, i) => {
    if (scrollTo.mock.contexts[i] === col) top = call[0].top
  })
  return top
}

const highlighted = (col: HTMLElement) =>
  within(col).queryAllByRole('button').filter((b) => b.className.includes('bg-primary'))

beforeEach(() => scrollTo.mockClear())

it('opens at an hour after the start when End is empty', () => {
  const { col } = open('06:00', '')
  expect(within(col).getByText('7:00 AM')).toBeInTheDocument()
  expect(within(col).getByText('6:30 AM')).toBeInTheDocument()
  for (const t of ['6:00 AM', '5:45 AM', '12:00 AM']) expect(within(col).queryByText(t)).toBeNull()
  expect(lastTopFor(col)).toBe(3 * 48)
  expect(highlighted(col).map((b) => b.textContent)).toEqual(['7:00 AM'])
  expect(screen.getByRole('button', { name: /Confirm 1h/ })).toBeInTheDocument()
})

it('opens at the held end', () => {
  const { col } = open('06:00', '07:00')
  expect(lastTopFor(col)).toBe(3 * 48)
})

it('keeps an off-grid held end', () => {
  const { col, onEnd } = open('06:00', '07:13')
  expect(lastTopFor(col)).toBe(3 * 48)
  expect(highlighted(col)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
  expect(onEnd).toHaveBeenCalledWith('07:13')
})

it('wraps past midnight for a late start', () => {
  const { col } = open('23:00', '')
  expect(within(col).getByText('12:00 AM')).toBeInTheDocument()
  expect(within(col).getByText('1:00 AM')).toBeInTheDocument()
  expect(within(col).queryByText('10:45 PM')).toBeNull()
  expect(lastTopFor(col)).toBe(3 * 48)
})

it('saves a tapped slot', () => {
  const { col, onEnd } = open('06:00', '')
  fireEvent.click(within(col).getByText('6:30 AM'))
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
  expect(onEnd).toHaveBeenCalledWith('06:30')
})
