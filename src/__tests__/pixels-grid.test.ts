/**
 * @jest-environment node
 *
 * The year grid's week maths, over the year shapes a calendar can take: one
 * starting on a Monday, one starting on a Sunday, a leap year, and the
 * current year, which is only part drawn. These are the cases the old
 * 12×31 grid never had to think about, because its rows were day numbers
 * rather than weekdays.
 */

import { buildPixelsGrid, columnForDate, WEEKDAYS } from '@/lib/pixels-grid'

const END_OF_YEAR = (year: number) => `${year}-12-31`

/** Every date the grid shows, in order. */
const shown = (year: number, today: string) =>
  buildPixelsGrid(year, today)
    .weeks.flat()
    .filter((d): d is string => d !== null)

describe.each([
  ['a year starting on a Monday', 2024, 366],
  ['a leap year starting mid-week', 2028, 366],
  ['a year starting on a Thursday', 2026, 365],
  ['a year starting on a Sunday', 2023, 365],
])('%s', (_name, year, days) => {
  const grid = buildPixelsGrid(year, END_OF_YEAR(year))

  it('shows every day of the year exactly once', () => {
    const dates = shown(year, END_OF_YEAR(year))
    expect(dates).toHaveLength(days)
    expect(new Set(dates).size).toBe(days)
    expect(dates[0]).toBe(`${year}-01-01`)
    expect(dates[days - 1]).toBe(`${year}-12-31`)
  })

  it('keeps the days in order', () => {
    const dates = shown(year, END_OF_YEAR(year))
    expect([...dates].sort()).toEqual(dates)
  })

  it('lays out whole weeks of seven', () => {
    expect(grid.weeks.length).toBeGreaterThanOrEqual(52)
    expect(grid.weeks.length).toBeLessThanOrEqual(54)
    for (const week of grid.weeks) expect(week).toHaveLength(7)
  })

  it('puts each weekday in its own row', () => {
    // Row 0 is Monday, row 6 is Sunday — the point of the layout: a row is
    // "every Monday of the year", which the 12×31 grid could not express.
    grid.weeks.forEach((week) => {
      week.forEach((date, row) => {
        if (!date) return
        const [y, m, d] = date.split('-').map(Number)
        const weekday = new Date(y, m - 1, d).getDay() // 0 = Sunday
        expect(WEEKDAYS[row]).toBe(WEEKDAYS[(weekday + 6) % 7])
      })
    })
  })

  it('labels all twelve months, in order, each above a real column', () => {
    expect(grid.monthLabels.map((l) => l.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
    const columns = grid.monthLabels.map((l) => l.column)
    expect([...columns].sort((a, b) => a - b)).toEqual(columns)
    expect(Math.max(...columns)).toBeLessThan(grid.weeks.length)
  })
})

describe('the year in progress', () => {
  const grid = buildPixelsGrid(2026, '2026-11-03')

  it('stops at today rather than painting the rest of the year as no data', () => {
    const dates = grid.weeks.flat().filter((d): d is string => d !== null)
    expect(dates[dates.length - 1]).toBe('2026-11-03')
    expect(dates).toContain('2026-11-02')
    expect(dates).not.toContain('2026-11-04')
  })

  it('still reserves the columns and labels for the rest of the year', () => {
    // The year keeps its shape: December is drawn, just empty.
    expect(grid.monthLabels.map((l) => l.label)).toContain('Dec')
    expect(grid.weeks.length).toBeGreaterThanOrEqual(52)
  })

  it('finds the column holding a given day, for scrolling to it', () => {
    const column = columnForDate(grid, '2026-11-03')
    expect(column).toBeGreaterThan(0)
    expect(grid.weeks[column]).toContain('2026-11-03')
    expect(columnForDate(grid, '2026-12-25')).toBe(-1) // not drawn yet
  })
})

describe('padding', () => {
  it('leaves the days before 1 January empty', () => {
    // 2026 starts on a Thursday, so Mon–Wed of the first column are 2025.
    const [first] = buildPixelsGrid(2026, END_OF_YEAR(2026)).weeks
    expect(first.slice(0, 3)).toEqual([null, null, null])
    expect(first[3]).toBe('2026-01-01')
  })

  it('leaves the days after 31 December empty', () => {
    const grid = buildPixelsGrid(2026, END_OF_YEAR(2026))
    const last = grid.weeks[grid.weeks.length - 1]
    // 2026 ends on a Thursday: Fri–Sun belong to 2027.
    expect(last[3]).toBe('2026-12-31')
    expect(last.slice(4)).toEqual([null, null, null])
  })

  it('needs no padding at all when the year starts Monday and ends Sunday', () => {
    const grid = buildPixelsGrid(2024, END_OF_YEAR(2024))
    expect(grid.weeks[0][0]).toBe('2024-01-01')
  })
})
