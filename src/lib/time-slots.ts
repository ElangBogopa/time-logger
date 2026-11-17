import { timeToMinutes } from './time-utils'

/** Every 15-minute slot of a day, 00:00 to 23:45. */
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return slots
})()

/** The longest stretch one entry may cover. */
export const MAX_RANGE_MINUTES = 16 * 60

function minutesAfter(start: string, slot: string): number {
  return (timeToMinutes(slot) - timeToMinutes(start) + 1440) % 1440
}

/**
 * The slots an entry starting at `start` could end at: every slot after it,
 * in order of time after the start, wrapping past midnight, up to 16 hours.
 */
export function endSlotsAfter(start: string): string[] {
  return TIME_SLOTS.map((slot) => ({ slot, after: minutesAfter(start, slot) }))
    .filter(({ after }) => after > 0 && after <= MAX_RANGE_MINUTES)
    .sort((a, b) => a.after - b.after)
    .map(({ slot }) => slot)
}

/** The first end slot at least an hour after `start`. */
export function defaultEndAfter(start: string): string {
  const slots = endSlotsAfter(start)
  return slots.find((slot) => minutesAfter(start, slot) >= 60) ?? slots[slots.length - 1]
}

/** A held midnight written as 24:00 is the 00:00 slot. */
export function normalizeEnd(end: string): string {
  return end === '24:00' ? '00:00' : end
}

/**
 * The slot the End column opens at: the held end if the list has it,
 * otherwise an hour after the start.
 */
export function endScrollTarget(start: string, end: string): string {
  const held = normalizeEnd(end)
  return endSlotsAfter(start).includes(held) ? held : defaultEndAfter(start)
}
