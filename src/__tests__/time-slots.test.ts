import { endSlotsAfter, defaultEndAfter, endScrollTarget } from '@/lib/time-slots'

describe('endSlotsAfter', () => {
  it('lists the slots after a 6:00 start, 16 hours at most', () => {
    const slots = endSlotsAfter('06:00')
    expect(slots.slice(0, 4)).toEqual(['06:15', '06:30', '06:45', '07:00'])
    expect(slots[slots.length - 1]).toBe('22:00')
    expect(slots).toHaveLength(64)
    for (const early of ['00:00', '03:00', '05:45', '06:00']) expect(slots).not.toContain(early)
  })
  it('wraps past midnight', () => {
    const slots = endSlotsAfter('23:00')
    expect(slots.slice(0, 5)).toEqual(['23:15', '23:30', '23:45', '00:00', '00:15'])
    expect(slots[slots.length - 1]).toBe('15:00')
    expect(slots).not.toContain('22:45')
    expect(slots).not.toContain('23:00')
  })
  it('starts at the next slot for an off-grid start', () => {
    expect(endSlotsAfter('07:13')[0]).toBe('07:15')
  })
})

describe('defaultEndAfter', () => {
  it('is the first slot an hour or more after the start', () => {
    expect(defaultEndAfter('06:00')).toBe('07:00')
    expect(defaultEndAfter('07:13')).toBe('08:15')
    expect(defaultEndAfter('23:30')).toBe('00:30')
  })
})

describe('endScrollTarget', () => {
  it.each([
    ['06:00', '07:00', '07:00'],
    ['06:00', '', '07:00'],
    ['06:00', '07:13', '07:00'],
    ['06:00', '08:10', '07:00'],
    ['06:00', '05:00', '07:00'],
    ['18:00', '24:00', '00:00'],
  ])('start %s end %s -> %s', (start, end, want) => {
    expect(endScrollTarget(start, end)).toBe(want)
  })
})
