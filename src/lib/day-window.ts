/**
 * Which hours of a day are worth drawing.
 *
 * The grid rendered all twenty-four, at 45px an hour: 1080 pixels of mostly
 * empty night in a 500-pixel window, so the day you actually lived was
 * something you had to scroll to find. Calendar day views solve this by not
 * stretching hours nothing happens in.
 *
 * This picks the window: everything logged or planned, an hour of air either
 * side, never narrower than a readable span, and always including now on
 * today so the current-time line has somewhere to be.
 */

export interface DayBlock {
  startMinutes: number
  endMinutes: number
}

export interface DayWindow {
  startHour: number
  endHour: number
}

const DAY_END = 24

export function dayWindow({
  blocks,
  nowMinutes = null,
  minimumHours = 8,
  maximumHours = 12,
  padHours = 1,
}: {
  blocks: DayBlock[]
  /** Minutes past midnight, on today only. */
  nowMinutes?: number | null
  /** Never show less than this, so the grid does not jump about. */
  minimumHours?: number
  /**
   * Never show more than this without being asked. Reaching to include a
   * current time hours away from anything stretched a day of 08:30–18:00
   * into a 2:00–19:00 grid, which is the empty-night problem coming back in
   * through the side door.
   */
  maximumHours?: number
  padHours?: number
}): DayWindow {
  const real = blocks.filter((b) => b.endMinutes > b.startMinutes)

  // An empty day: sit around now, or around the middle of a working day.
  if (real.length === 0) {
    const centre = nowMinutes !== null ? nowMinutes / 60 : 13
    return clampSpan(centre - minimumHours / 2, centre + minimumHours / 2, minimumHours)
  }

  const earliest = Math.min(...real.map((b) => b.startMinutes)) / 60
  const latest = Math.max(...real.map((b) => b.endMinutes)) / 60

  const start = Math.floor(earliest) - padHours
  const end = Math.ceil(latest) + padHours

  // Reach for the current-time line, but not at the cost of the day: if
  // including it would blow past the cap, the day keeps the frame.
  let from = start
  let to = end
  if (nowMinutes !== null) {
    const withNow = {
      from: Math.min(start, Math.floor(nowMinutes / 60)),
      to: Math.max(end, Math.ceil(nowMinutes / 60) + 1),
    }
    if (withNow.to - withNow.from <= maximumHours) {
      from = withNow.from
      to = withNow.to
    }
  }

  return clampSpan(from, to, minimumHours)
}

/** Grow a window to the minimum span, then pin it inside the day. */
function clampSpan(start: number, end: number, minimumHours: number): DayWindow {
  let from = Math.round(start)
  let to = Math.round(end)

  while (to - from < minimumHours) {
    if (from > 0) from -= 1
    else if (to < DAY_END) to += 1
    else break
  }

  if (from < 0) {
    to = Math.min(DAY_END, to - from)
    from = 0
  }
  if (to > DAY_END) {
    from = Math.max(0, from - (to - DAY_END))
    to = DAY_END
  }

  return { startHour: from, endHour: to }
}

/** True when the window is already the whole day. */
export function isWholeDay({ startHour, endHour }: DayWindow): boolean {
  return startHour === 0 && endHour === DAY_END
}
