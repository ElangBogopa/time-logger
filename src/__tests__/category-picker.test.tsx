/**
 * Correcting a category. The categoriser is a model and is sometimes wrong;
 * until this picker there was no way to say so, and every score is built
 * on categories.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import CategoryPicker from '@/components/CategoryPicker'
import { CATEGORY_LABELS, TimeCategory } from '@/lib/types'

it('offers every category exactly once', () => {
  render(<CategoryPicker value="deep_work" onChange={() => {}} />)
  const options = screen.getAllByRole('radio')
  expect(options).toHaveLength(Object.keys(CATEGORY_LABELS).length)
  for (const label of Object.values(CATEGORY_LABELS)) {
    expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
  }
})

it('marks the current category, and only that one', () => {
  render(<CategoryPicker value="meetings" onChange={() => {}} />)
  const checked = screen.getAllByRole('radio').filter((el) => el.getAttribute('aria-checked') === 'true')
  expect(checked).toHaveLength(1)
  expect(checked[0]).toHaveTextContent(CATEGORY_LABELS.meetings)
})

it('reports the category that was tapped', () => {
  const onChange = jest.fn()
  render(<CategoryPicker value="deep_work" onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: CATEGORY_LABELS.meetings }))
  expect(onChange).toHaveBeenCalledWith<[TimeCategory]>('meetings')
})

it('cannot be used while a change is being saved', () => {
  const onChange = jest.fn()
  render(<CategoryPicker value="deep_work" onChange={onChange} disabled />)
  fireEvent.click(screen.getByRole('radio', { name: CATEGORY_LABELS.meetings }))
  expect(onChange).not.toHaveBeenCalled()
})
