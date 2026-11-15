import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import TimelineView from '@/components/TimelineView'

Element.prototype.scrollTo = jest.fn()

describe('TimelineView mouse drag-to-create', () => {
  const setup = () => {
    const onDragCreate = jest.fn()
    const { container } = render(
      <TimelineView
        entries={[]}
        calendarEvents={[]}
        isLoading={false}
        onEntryDeleted={jest.fn()}
        onDragCreate={onDragCreate}
        isToday={true}
      />
    )
    const grid = container.querySelector('.cursor-crosshair') as HTMLElement
    return { onDragCreate, grid }
  }

  it('creates on mouse up after a mouse down (control)', () => {
    const { onDragCreate, grid } = setup()
    fireEvent.mouseDown(grid, { button: 0, clientY: 200 })
    fireEvent.mouseUp(window)
    expect(onDragCreate).toHaveBeenCalledTimes(1)
  })

  it('Escape cancels the drag', () => {
    const { onDragCreate, grid } = setup()
    fireEvent.mouseDown(grid, { button: 0, clientY: 200 })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.mouseUp(window)
    expect(onDragCreate).not.toHaveBeenCalled()
  })
})
