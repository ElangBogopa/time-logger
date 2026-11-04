/**
 * Layout for the year grid.
 *
 * The grid used to be 12 columns (months) by 31 rows (days), which made a
 * year a long scroll through mostly empty space — and 31 rows that do not
 * line up with anything, since the 14th of one month is not the same weekday
 * as the 14th of the next. This is the GitHub contributions layout instead:
 * one column per week, seven rows for the days of the week, so the whole year
 * is one band and every row is a weekday.
 *
 * Pure, and kept out of the page so the week maths can be tested across year
 * shapes — a year starting on a Monday, on a Sunday, a leap year — rather
 * than only the one the calendar happens to be on today.
 *
 * Dates are strings throughout and never round-trip through UTC; see the
 * dates note in CLAUDE.md.
 */

import { shiftDateString, getWeekStartForDate } from './types'

/** A date in the year, or null for a cell outside it (padding or future). */
export type GridCell = string | null

export interface MonthLabel {
  label: string
  /** Index into `weeks` of the column the label sits above. */
  column: number
}

export interface PixelsGrid {
  /** Columns of seven cells, Monday first. */
  weeks: GridCell[][]
  monthLabels: MonthLabel[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Monday-first weekday labels, for the gutter down the left of the grid. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * @param year  the year to lay out
 * @param today YYYY-MM-DD; days after it are left empty, so the current year
 *              does not show three months of blank cells as "no data"
 */
export function buildPixelsGrid(year: number, today: string): PixelsGrid {
  // Start at the Monday on or before 1 January, so the first column is a full
  // week and every row is one weekday all year.
  const firstDay = `${year}-01-01`
  const lastDay = `${year}-12-31`
  const start = getWeekStartForDate(firstDay, 1)
  const end = shiftDateString(getWeekStartForDate(lastDay, 1), 6)

  const weeks: GridCell[][] = []
  const monthLabels: MonthLabel[] = []
  let lastLabelledMonth = -1

  let cursor = start
  while (cursor <= end) {
    // The week's seven real dates, before any are blanked out. The labels are
    // worked out from these, so a month still gets its label when every day
    // in its first week is in the future.
    const dates: string[] = []
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      dates.push(cursor)
      cursor = shiftDateString(cursor, 1)
    }

    const week: GridCell[] = dates.map((date) =>
      date >= firstDay && date <= lastDay && date <= today ? date : null
    )

    // A month's label sits above the first week that month appears in.
    const firstInYear = dates.find((date) => date >= firstDay && date <= lastDay)
    if (firstInYear) {
      const month = Number(firstInYear.slice(5, 7)) - 1
      if (month !== lastLabelledMonth) {
        monthLabels.push({ label: MONTHS[month], column: weeks.length })
        lastLabelledMonth = month
      }
    }

    weeks.push(week)
  }

  return { weeks, monthLabels }
}

/** Index of the column holding a date, or -1. For scrolling to today. */
export function columnForDate(grid: PixelsGrid, date: string): number {
  return grid.weeks.findIndex((week) => week.includes(date))
}
