/**
 * The read: the one decision a review leads with.
 *
 * Each review used to open on a paragraph of totals the model wrote from a
 * table. It now leads with one read — Keep (something worked, and why),
 * Change (only with three or more days behind it, never one off day; it
 * names an hour) or Nothing (an ordinary day, said plainly) — chosen here by
 * fixed rules from the log. The model is given only the fact sentences this
 * file writes and words them; if it gives nothing, `plainReadText` is shown.
 *
 * Pure: no React, no fetch, no model. Dates are date strings throughout and
 * where a row sits in its day is always `onDayTimes`, never the raw times.
 */

import {
  CATEGORY_LABELS,
  getWeekStartForDate,
  shiftDateString,
  type TimeCategory,
} from './types'
import {
  calcBody,
  calcFocus,
  calcSocial,
  classifyIntensity,
  countsTowardHeart,
  exerciseMinutes,
  heartMinutes,
  EXERCISE_TARGET,
  INTENSITY_MULTIPLIER,
  METRIC_THRESHOLDS,
} from './metrics-calc'
import { onDayTimes } from './overnight'
import { windowAlignment, type AlignmentFact } from './window-alignment'
import type { DayWindow } from './ideal-day'
import { usualFor, type HabitEntry } from './habits'
import { activityKey, activityMatch } from './plan-adherence'
import { formatDuration, formatTimeDisplay, minutesToTime, timeToMinutes } from './time-utils'
import { NO_FRIENDS_OR_FAMILY } from './prompts'

/** "1h of 2h", and "none of 2h" where nothing was inside: "0m of 2h" reads as a typo. */
function ofTotal(inside: number, total: number): string {
  return `${inside > 0 ? formatDuration(inside) : 'none'} of ${formatDuration(total)}`
}

// ── Types ──

/** A confirmed entry with a category, reduced to what the rules read. */
export interface Row {
  date: string
  activity: string
  category: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number
}

export type ReadKind = 'keep' | 'change' | 'nothing'

export interface ReadSlot {
  title: string
  /** HH:MM */
  startTime: string
  durationMinutes: number
}

export interface ReviewRead {
  scope: 'day' | 'week'
  kind: ReadKind
  /** Which rule chose it: the ids in the brief, e.g. 'keep-long-focus'. */
  rule: string
  /** Whole sentences; the only thing the model is given. */
  facts: string[]
  evidence: { label: string; value: string }[]
  /** Keep: when it happened. Change: the hour proposed. */
  slot: ReadSlot | null
  /** True → "In your windows" is shown as evidence. */
  timing: boolean
}

export type RingKey = 'body' | 'focus' | 'social'
export const RING_KEYS: RingKey[] = ['body', 'focus', 'social']

// ── Constants ──

/** Fewer logged days than this in the history and there is no "usual". */
export const MIN_HISTORY_DAYS = 7
/** A Change can never come from fewer days than this. */
export const A_FEW_DAYS = 3
/** Past a week a run is the weekly review's subject, not a daily repeat. */
const MAX_RUN = 7
/** How far back a run may look, in calendar days. */
const RUN_LOOKBACK = 14
/** How far a ring score must sit from the usual to be above or below it. */
const RELATION_GAP = 8
const FOCUS_CATS = ['deep_work', 'learning', 'creating']
const MOVEMENT_CATS = ['exercise', 'movement']
const SLOT = 15

// ── Small helpers ──

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Mon 16 Nov" */
export function dayLabel(date: string): string {
  const d = parts(date)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "Mon" */
export function weekdayLabel(date: string): string {
  return WEEKDAYS[parts(date).getDay()]
}

const at = (minutes: number) => formatTimeDisplay(minutesToTime(minutes))
const round15 = (minutes: number) => Math.round(minutes / SLOT) * SLOT
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** "a", "a and b", "a, b and c" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "20 minutes", "1 minute", "1h 20m" */
function minutesPhrase(minutes: number): string {
  const m = Math.round(minutes)
  if (m === 1) return '1 minute'
  if (m < 60) return `${m} minutes`
  return formatDuration(m)
}

function daysPhrase(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

function byDate(rows: Row[]): Map<string, Row[]> {
  const map = new Map<string, Row[]>()
  for (const row of rows) {
    const list = map.get(row.date)
    if (list) list.push(row)
    else map.set(row.date, [row])
  }
  return map
}

/** Minutes from midnight at which a row starts on its own date. */
function startOnDay(row: Row): number | null {
  const times = onDayTimes(row)
  return times ? timeToMinutes(times.start) : null
}

const isFocus = (row: Row) => FOCUS_CATS.includes(row.category)
const isMovement = (row: Row) => MOVEMENT_CATS.includes(row.category)

export function focusMinutes(rows: Row[]): number {
  return rows.filter(isFocus).reduce((sum, row) => sum + row.duration_minutes, 0)
}

/** The day's focus row with a start time and the largest duration. */
export function longestFocusBlock(rows: Row[]): Row | null {
  let best: Row | null = null
  for (const row of rows) {
    if (!isFocus(row) || startOnDay(row) === null) continue
    if (!best || row.duration_minutes > best.duration_minutes) best = row
  }
  return best
}

/** The day's earliest focus row with a start time. */
function firstFocusBlock(rows: Row[]): Row | null {
  let best: Row | null = null
  for (const row of rows) {
    if (!isFocus(row)) continue
    const start = startOnDay(row)
    if (start === null) continue
    if (!best || start < (startOnDay(best) as number)) best = row
  }
  return best
}

/** Moderate-equivalent minutes a movement row is worth. */
function movementWorth(row: Row): number {
  return row.duration_minutes * INTENSITY_MULTIPLIER[classifyIntensity(row.category, row.activity)]
}

/** The day's movement row worth the most moderate-equivalent minutes, with a start time. */
function largestMovementRow(rows: Row[]): Row | null {
  let best: Row | null = null
  for (const row of rows) {
    if (!isMovement(row) || startOnDay(row) === null) continue
    if (!best || movementWorth(row) > movementWorth(best)) best = row
  }
  return best
}

/** The rows as they sit on their own date, for the window sums. */
function onDayRows(rows: Row[]) {
  return rows.map((row) => {
    const times = onDayTimes(row)
    return {
      category: row.category as TimeCategory,
      activity: row.activity,
      start_time: times?.start ?? null,
      end_time: times?.end ?? null,
      duration_minutes: row.duration_minutes,
    }
  })
}

/** How much focused work, exercise and time with people fell in the windows, by where each row sits on its day. */
export function alignmentOnDay(rows: Row[], windows: DayWindow[]): AlignmentFact[] {
  return windowAlignment(onDayRows(rows), windows)
}

function focusAlignment(rows: Row[], windows: DayWindow[]): AlignmentFact | null {
  return alignmentOnDay(rows, windows).find((fact) => fact.key === 'focus') ?? null
}

/** At least an hour of timed focus, less than half of it in the windows. */
function focusOutsideWindows(rows: Row[], windows: DayWindow[]): boolean {
  const fact = focusAlignment(rows, windows)
  return !!fact && fact.totalMinutes >= 60 && fact.inWindowMinutes * 2 < fact.totalMinutes
}

const focusWindowsOf = (windows: DayWindow[]) => windows.filter((w) => w.categories.includes('deep_work'))
const movementWindowsOf = (windows: DayWindow[]) => windows.filter((w) => w.categories.includes('exercise'))
const windowRange = (w: DayWindow) => `${at(w.startMinutes)}–${at(w.endMinutes)}`
const windowAtMinute = (windows: DayWindow[], minute: number) =>
  windows.find((w) => minute >= w.startMinutes && minute < w.endMinutes) ?? null

function ringScores(rows: Row[]): Record<RingKey, number> {
  return { body: calcBody(rows), focus: calcFocus(rows), social: calcSocial(rows) }
}

// ── The ring lines ──

export interface RingComparison {
  usual: number
  relation: 'above' | 'below' | 'about'
}

export interface RingComparisons {
  /** Null for all three when the history has too few logged days. */
  rings: Record<RingKey, RingComparison | null>
  /** Logged days in the history. */
  loggedDays: number
}

/** The median of each ring over the history's logged days, or null with too few of them. */
export function usualRings(history: Row[]): Record<RingKey, number> | null {
  const days = [...byDate(history).values()]
  if (days.length < MIN_HISTORY_DAYS) return null
  const scores = days.map(ringScores)
  return {
    body: Math.round(median(scores.map((s) => s.body))),
    focus: Math.round(median(scores.map((s) => s.focus))),
    social: Math.round(median(scores.map((s) => s.social))),
  }
}

export function ringComparisons(scores: Record<RingKey, number>, history: Row[]): RingComparisons {
  const loggedDays = byDate(history).size
  const usual = usualRings(history)
  const rings = {} as Record<RingKey, RingComparison | null>
  for (const key of RING_KEYS) {
    if (!usual) {
      rings[key] = null
      continue
    }
    const gap = scores[key] - usual[key]
    rings[key] = {
      usual: usual[key],
      relation: gap >= RELATION_GAP ? 'above' : gap <= -RELATION_GAP ? 'below' : 'about',
    }
  }
  return { rings, loggedDays }
}

/** The fixed strings under each ring, or the one line under the row. Never model output. */
export function ringNotes(comparisons: RingComparisons): {
  notes: Partial<Record<RingKey, string>>
  caption?: string
} {
  const notes: Partial<Record<RingKey, string>> = {}
  let any = false
  for (const key of RING_KEYS) {
    const c = comparisons.rings[key]
    if (!c) continue
    any = true
    notes[key] =
      c.relation === 'above'
        ? `Above your usual ${c.usual}`
        : c.relation === 'below'
          ? `Below your usual ${c.usual}`
          : 'About your usual'
  }
  if (any) return { notes }
  const n = comparisons.loggedDays
  return {
    notes,
    caption: `Too little history to compare yet: ${n} of the last 28 days ${n === 1 ? 'has' : 'have'} anything logged.`,
  }
}

// ── Shared pieces of the rules ──

interface HistoryFacts {
  byDay: Map<string, Row[]>
  loggedDays: number
  hasUsual: boolean
  usual: Record<RingKey, number> | null
}

function historyFacts(history: Row[]): HistoryFacts {
  const byDay = byDate(history)
  const usual = usualRings(history)
  return { byDay, loggedDays: byDay.size, hasUsual: usual !== null, usual }
}

/** The movement activity logged on the most history days; a tie goes to the most recent. */
function usualMovementActivity(history: Row[]): string | null {
  const groups = new Map<string, { days: Set<string>; last: string; title: string }>()
  for (const row of history) {
    if (!isMovement(row)) continue
    const key = activityKey(row.activity) || row.activity.toLowerCase()
    const group = groups.get(key) ?? { days: new Set<string>(), last: '', title: row.activity }
    group.days.add(row.date)
    if (row.date >= group.last) {
      group.last = row.date
      group.title = row.activity
    }
    groups.set(key, group)
  }
  let best: { days: Set<string>; last: string; title: string } | null = null
  for (const group of groups.values()) {
    if (!best || group.days.size > best.days.size || (group.days.size === best.days.size && group.last > best.last)) {
      best = group
    }
  }
  return best?.title ?? null
}

/** The slot a lapsed movement habit is offered: its usual hour and length, else the last movement window. */
function movementSlot(history: Row[], windows: DayWindow[]): { slot: ReadSlot; usualStart: number | null } | null {
  const title = usualMovementActivity(history)
  if (!title) return null
  const usual = usualFor(title, 'exercise', history as unknown as HabitEntry[])
  const lastWindow = movementWindowsOf(windows).sort((a, b) => b.startMinutes - a.startMinutes)[0]
  const start = usual?.startMinutes ?? lastWindow?.startMinutes ?? null
  if (start === null) return null
  return {
    slot: { title, startTime: minutesToTime(start), durationMinutes: usual?.durationMinutes ?? 30 },
    usualStart: usual?.startMinutes ?? null,
  }
}

function movementDayCount(byDay: Map<string, Row[]>): number {
  let n = 0
  for (const rows of byDay.values()) if (exerciseMinutes(rows) > 0) n++
  return n
}

function slotFromRow(row: Row, max = 180): ReadSlot {
  return {
    title: row.activity,
    startTime: minutesToTime(startOnDay(row) as number),
    durationMinutes: clamp(round15(row.duration_minutes), SLOT, max),
  }
}

/** The one or two largest categories by minutes, never Sleep. */
function mostTimeFact(rows: Row[]): string | null {
  const minutes = new Map<string, number>()
  for (const row of rows) {
    if (row.category === 'sleep') continue
    minutes.set(row.category, (minutes.get(row.category) ?? 0) + row.duration_minutes)
  }
  const top = [...minutes.entries()]
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category, m]) => `${CATEGORY_LABELS[category as TimeCategory] ?? category} (${formatDuration(m)})`)
  if (top.length === 0) return null
  return `Most of the logged time went to ${listJoin(top)}.`
}

interface Candidate {
  read: ReviewRead
  ring: RingKey
}

/** The Keep whose ring is furthest above its usual; with no usual, or a tie, the table's order. */
function bestKeep(
  keeps: Candidate[],
  scores: Record<RingKey, number>,
  usual: Record<RingKey, number> | null
): ReviewRead | null {
  if (keeps.length === 0) return null
  if (!usual) return keeps[0].read
  let best = keeps[0]
  for (const keep of keeps.slice(1)) {
    if (scores[keep.ring] - usual[keep.ring] > scores[best.ring] - usual[best.ring]) best = keep
  }
  return best.read
}

// ── The day ──

export interface DayReadInput {
  date: string
  /** The reviewed day's rows. */
  rows: Row[]
  /** The 28 days before the reviewed day. */
  history: Row[]
  windows: DayWindow[]
}

/**
 * Consecutive logged days ending at the reviewed day on which the condition
 * holds, newest first, looking back at most 14 calendar days. A day with
 * nothing logged neither counts nor breaks the run. Empty unless the
 * reviewed day itself is logged and holds it.
 */
function runOf(date: string, byDay: Map<string, Row[]>, holds: (rows: Row[]) => boolean): string[] {
  const days: string[] = []
  for (let back = 0; back < RUN_LOOKBACK; back++) {
    const d = shiftDateString(date, -back)
    const rows = byDay.get(d)
    if (!rows || rows.length === 0) {
      if (back === 0) return []
      continue
    }
    if (!holds(rows)) break
    days.push(d)
  }
  return days
}

const firesAsRun = (run: string[]) => run.length >= A_FEW_DAYS && run.length <= MAX_RUN

export function dayRead({ date, rows, history, windows }: DayReadInput): ReviewRead {
  const h = historyFacts(history)
  const allByDay = byDate([...history.filter((r) => r.date < date), ...rows.map((r) => ({ ...r, date }))])
  const focusWindows = focusWindowsOf(windows)
  const base = { scope: 'day' as const }

  // ── Changes, in order ──

  const historyMovementDays = movementDayCount(h.byDay)
  if (historyMovementDays >= A_FEW_DAYS) {
    const run = runOf(date, allByDay, (r) => exerciseMinutes(r) === 0)
    const offer = firesAsRun(run) ? movementSlot(history, windows) : null
    if (offer) {
      const days = [...run].reverse()
      return {
        ...base,
        kind: 'change',
        rule: 'change-no-movement',
        facts: [
          `No movement was logged on ${days.length} days in a row: ${listJoin(days.map(dayLabel))}.`,
          `In the four weeks before, movement was logged on ${daysPhrase(historyMovementDays)}${
            offer.usualStart !== null ? `, usually around ${at(offer.usualStart)}` : ''
          }.`,
          `One option: ${offer.slot.title} at ${at(timeToMinutes(offer.slot.startTime))}.`,
        ],
        evidence: [
          ...days.map((d) => ({ label: dayLabel(d), value: 'No movement' })),
          { label: 'Last four weeks', value: `Movement on ${daysPhrase(historyMovementDays)}` },
        ],
        slot: offer.slot,
        timing: false,
      }
    }
  }

  if (focusWindows.length > 0) {
    const run = runOf(date, allByDay, (r) => focusOutsideWindows(r, windows))
    const block = longestFocusBlock(rows)
    const today = focusAlignment(rows, windows)
    if (firesAsRun(run) && block && today) {
      const days = [...run].reverse()
      const slot: ReadSlot = {
        title: block.activity,
        startTime: minutesToTime(focusWindows[0].startMinutes),
        durationMinutes: clamp(round15(block.duration_minutes), 30, 120),
      }
      return {
        ...base,
        kind: 'change',
        rule: 'change-focus-outside-window',
        facts: [
          `On ${days.length} days in a row, less than half of the focused work fell inside the focus windows (${listJoin(
            focusWindows.map(windowRange)
          )}).`,
          `On this day it was ${ofTotal(today.inWindowMinutes, today.totalMinutes)}.`,
          `One option: ${slot.title} at ${at(focusWindows[0].startMinutes)}.`,
        ],
        evidence: days.map((d) => {
          const fact = focusAlignment(allByDay.get(d) ?? [], windows)
          return {
            label: dayLabel(d),
            value: `${ofTotal(fact?.inWindowMinutes ?? 0, fact?.totalMinutes ?? 0)} inside`,
          }
        }),
        slot,
        timing: true,
      }
    }
  }

  // ── Keeps: the reviewed day, against what is usual ──

  const keeps: Candidate[] = []

  const block = longestFocusBlock(rows)
  if (block && block.duration_minutes >= 60) {
    const historyBlocks = [...h.byDay.values()]
      .map(longestFocusBlock)
      .filter((b): b is Row => b !== null)
      .map((b) => b.duration_minutes)
    const med = historyBlocks.length >= 5 ? Math.round(median(historyBlocks)) : null
    const fires = med !== null ? block.duration_minutes >= 1.25 * med : block.duration_minutes >= 90
    if (fires) {
      const start = startOnDay(block) as number
      const inside = windowAtMinute(focusWindows, start)
      keeps.push({
        ring: 'focus',
        read: {
          ...base,
          kind: 'keep',
          rule: 'keep-long-focus',
          facts: [
            `The longest focused block was ${formatDuration(block.duration_minutes)} on "${block.activity}", starting at ${at(start)}.`,
            ...(med !== null ? [`The usual longest block over the last four weeks is ${formatDuration(med)}.`] : []),
            ...(inside ? [`It started inside the focus window (${windowRange(inside)}).`] : []),
          ],
          evidence: [
            { label: 'Longest focused block', value: `${formatDuration(block.duration_minutes)}, from ${at(start)}` },
            ...(med !== null
              ? [{ label: 'Usual longest block', value: `${formatDuration(med)} over ${historyBlocks.length} days` }]
              : []),
          ],
          slot: slotFromRow(block, 180),
          timing: true,
        },
      })
    }
  }

  const movement = Math.round(exerciseMinutes(rows))
  if (movement >= EXERCISE_TARGET) {
    const usualMovement = h.hasUsual
      ? Math.round(median([...h.byDay.values()].map((r) => exerciseMinutes(r))))
      : null
    if (usualMovement === null || usualMovement < EXERCISE_TARGET) {
      const row = largestMovementRow(rows)
      const start = row ? (startOnDay(row) as number) : null
      const inside = start !== null ? windowAtMinute(movementWindowsOf(windows), start) : null
      const most = row && movementWorth(row) * 2 >= movement ? 'most of it' : 'the largest part'
      keeps.push({
        ring: 'body',
        read: {
          ...base,
          kind: 'keep',
          rule: 'keep-movement-target',
          facts: [
            row && start !== null
              ? `${movement} moderate-equivalent minutes of movement, ${most} "${row.activity}" at ${at(start)}, which reaches the movement target of ${EXERCISE_TARGET}.`
              : `${movement} moderate-equivalent minutes of movement, which reaches the movement target of ${EXERCISE_TARGET}.`,
            ...(usualMovement !== null
              ? [`The usual over the last four weeks is ${minutesPhrase(usualMovement)} a day.`]
              : []),
            ...(inside ? [`It fell inside the ${inside.label} window (${windowRange(inside)}).`] : []),
          ],
          evidence: [
            { label: 'Movement', value: `${movement} of ${EXERCISE_TARGET} minutes` },
            ...(usualMovement !== null ? [{ label: 'Usual', value: `${minutesPhrase(usualMovement)} a day` }] : []),
          ],
          slot: row ? slotFromRow(row) : null,
          timing: inside !== null,
        },
      })
    }
  }

  const heart = heartMinutes(rows)
  if (heart >= 60) {
    const usualHeart = h.hasUsual ? Math.round(median([...h.byDay.values()].map((r) => heartMinutes(r)))) : null
    if (usualHeart === null || usualHeart < 60) {
      let row: Row | null = null
      for (const r of rows) {
        if (!countsTowardHeart(r) || startOnDay(r) === null) continue
        if (!row || r.duration_minutes > row.duration_minutes) row = r
      }
      keeps.push({
        ring: 'social',
        read: {
          ...base,
          kind: 'keep',
          rule: 'keep-people-time',
          facts: [
            row
              ? `${formatDuration(heart)} with friends or family, the longest "${row.activity}" at ${at(startOnDay(row) as number)}.`
              : `${formatDuration(heart)} with friends or family.`,
            ...(usualHeart !== null ? [`The usual over the last four weeks is ${minutesPhrase(usualHeart)} a day.`] : []),
          ],
          evidence: [
            { label: 'With friends or family', value: formatDuration(heart) },
            ...(usualHeart !== null ? [{ label: 'Usual', value: `${minutesPhrase(usualHeart)} a day` }] : []),
          ],
          slot: row ? slotFromRow(row) : null,
          timing: false,
        },
      })
    }
  }

  const keep = bestKeep(keeps, ringScores(rows), h.usual)
  if (keep) return keep

  // ── Nothing ──
  // The day review never says there was no time with friends or family.
  const most = mostTimeFact(rows)
  return {
    ...base,
    kind: 'nothing',
    rule: 'nothing-ordinary',
    facts: [
      h.hasUsual
        ? 'An ordinary day: nothing in it stands apart from the last four weeks.'
        : 'An ordinary day. There is too little history yet to say what is usual.',
      ...(most ? [most] : []),
    ],
    evidence: [],
    slot: null,
    timing: false,
  }
}

// ── The week ──

export interface WeekReadInput {
  /** The week's days up to the last finished one, logged or not. */
  days: { date: string; rows: Row[] }[]
  /** The 28 days before the week's Monday. */
  history: Row[]
  windows: DayWindow[]
  isPartialWeek: boolean
  /** Minutes the Heart ring counts over the week. */
  weekHeartMinutes: number
}

function weekAverages(days: { rows: Row[] }[]): Record<RingKey, number> {
  const logged = days.filter((d) => d.rows.length > 0).map((d) => ringScores(d.rows))
  const avg = (key: RingKey) =>
    logged.length > 0 ? Math.round(logged.reduce((sum, s) => sum + s[key], 0) / logged.length) : 0
  return { body: avg('body'), focus: avg('focus'), social: avg('social') }
}

/** The most common activity among rows, by its key; a tie goes to the longest. */
function mostCommon(rows: Row[]): Row {
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const key = activityKey(row.activity) || row.activity.toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  let best: Row[] = []
  for (const group of groups.values()) {
    const longest = (g: Row[]) => Math.max(...g.map((r) => r.duration_minutes))
    if (group.length > best.length || (group.length === best.length && longest(group) > longest(best))) best = group
  }
  return best.reduce((a, b) => (b.duration_minutes > a.duration_minutes ? b : a))
}

export function weekRead({ days, history, windows, isPartialWeek, weekHeartMinutes }: WeekReadInput): ReviewRead {
  const read = chooseWeekRead(days, history, windows)
  const facts = [...read.facts]
  // A week in progress says so first and is never told what it lacks.
  if (isPartialWeek) facts.unshift('The week is still in progress.')
  else if (weekHeartMinutes === 0) facts.push(NO_FRIENDS_OR_FAMILY)
  return { ...read, facts }
}

function chooseWeekRead(days: { date: string; rows: Row[] }[], history: Row[], windows: DayWindow[]): ReviewRead {
  const h = historyFacts(history)
  const logged = days.filter((d) => d.rows.length > 0)
  const focusWindows = focusWindowsOf(windows)
  const base = { scope: 'week' as const }

  // ── Changes, in order ──

  const historyMovementDays = movementDayCount(h.byDay)
  const weekMovementDays = logged.filter((d) => exerciseMinutes(d.rows) > 0).length
  if (logged.length >= 5 && weekMovementDays <= 1 && historyMovementDays >= A_FEW_DAYS) {
    const offer = movementSlot(history, windows)
    if (offer) {
      return {
        ...base,
        kind: 'change',
        rule: 'week-change-movement-few-days',
        facts: [
          `Movement was logged on ${weekMovementDays} of the ${logged.length} days.`,
          `In the four weeks before, it was logged on ${daysPhrase(historyMovementDays)}${
            offer.usualStart !== null ? `, usually around ${at(offer.usualStart)}` : ''
          }.`,
          `One option: ${offer.slot.title} at ${at(timeToMinutes(offer.slot.startTime))}.`,
        ],
        evidence: [
          { label: 'This week', value: `Movement on ${weekMovementDays} of ${logged.length} days` },
          { label: 'Four weeks before', value: `Movement on ${daysPhrase(historyMovementDays)}` },
        ],
        slot: offer.slot,
        timing: false,
      }
    }
  }

  if (focusWindows.length > 0) {
    const offDays = logged.filter((d) => focusOutsideWindows(d.rows, windows))
    if (offDays.length >= A_FEW_DAYS) {
      const block = longestFocusBlock(offDays.flatMap((d) => d.rows))
      const week = focusAlignment(logged.flatMap((d) => d.rows), windows)
      if (block && week) {
        const slot: ReadSlot = {
          title: block.activity,
          startTime: minutesToTime(focusWindows[0].startMinutes),
          durationMinutes: clamp(round15(block.duration_minutes), 30, 120),
        }
        return {
          ...base,
          kind: 'change',
          rule: 'week-change-focus-outside-window',
          facts: [
            `On ${offDays.length} days (${listJoin(offDays.map((d) => weekdayLabel(d.date)))}), less than half of the focused work fell inside the focus windows (${listJoin(
              focusWindows.map(windowRange)
            )}).`,
            `Over the week it was ${ofTotal(week.inWindowMinutes, week.totalMinutes)}.`,
            `One option: ${slot.title} at ${at(focusWindows[0].startMinutes)}.`,
          ],
          evidence: offDays.map((d) => {
            const fact = focusAlignment(d.rows, windows)
            return {
              label: weekdayLabel(d.date),
              value: `${ofTotal(fact?.inWindowMinutes ?? 0, fact?.totalMinutes ?? 0)} inside`,
            }
          }),
          slot,
          timing: true,
        }
      }
    }
  }

  // ── Keeps ──

  const keeps: Candidate[] = []

  const mindDays = logged.filter((d) => calcFocus(d.rows) >= METRIC_THRESHOLDS.green)
  const otherDays = logged.length - mindDays.length
  if (mindDays.length >= 2 && otherDays >= 1) {
    const firsts = mindDays.map((d) => firstFocusBlock(d.rows))
    if (firsts.every((b) => b !== null)) {
      const blocks = firsts as Row[]
      const starts = blocks.map((b) => startOnDay(b) as number)
      if (Math.max(...starts) - Math.min(...starts) <= 60) {
        const start = round15(median(starts))
        const title = mostCommon(blocks).activity
        const n = mindDays.length
        keeps.push({
          ring: 'focus',
          read: {
            ...base,
            kind: 'keep',
            rule: 'week-keep-focus-start',
            facts: [
              `Mind reached its target on ${listJoin(mindDays.map((d) => weekdayLabel(d.date)))}.`,
              `On ${n === 2 ? 'both days' : `all ${n} days`} focused work began around ${at(start)}.`,
              otherDays === 1
                ? 'On the other day it did not reach it.'
                : `On the other ${otherDays} days it did not reach it.`,
            ],
            evidence: mindDays.map((d, i) => ({
              label: weekdayLabel(d.date),
              value: `from ${at(starts[i])}, ${formatDuration(focusMinutes(d.rows))} focused`,
            })),
            slot: {
              title,
              startTime: minutesToTime(start),
              durationMinutes: clamp(round15(median(blocks.map((b) => b.duration_minutes))), 30, 180),
            },
            timing: true,
          },
        })
      }
    }
  }

  const targetDays = logged.filter((d) => exerciseMinutes(d.rows) >= EXERCISE_TARGET)
  const historyTargetDays = [...h.byDay.values()].filter((r) => exerciseMinutes(r) >= EXERCISE_TARGET).length
  if (targetDays.length >= A_FEW_DAYS && targetDays.length > historyTargetDays / 4) {
    const sessions = targetDays.map((d) => largestMovementRow(d.rows))
    let slot: ReadSlot | null = null
    if (sessions.every((s) => s !== null)) {
      const rows = sessions as Row[]
      const starts = rows.map((r) => startOnDay(r) as number)
      if (Math.max(...starts) - Math.min(...starts) <= 120) {
        slot = {
          title: mostCommon(rows).activity,
          startTime: minutesToTime(round15(median(starts))),
          durationMinutes: clamp(round15(median(rows.map((r) => r.duration_minutes))), SLOT, 180),
        }
      }
    }
    keeps.push({
      ring: 'body',
      read: {
        ...base,
        kind: 'keep',
        rule: 'week-keep-movement-days',
        facts: [
          `The movement target was reached on ${targetDays.length} days: ${listJoin(targetDays.map((d) => weekdayLabel(d.date)))}.`,
          `In the four weeks before, it was reached on ${daysPhrase(historyTargetDays)} in all.`,
          ...(slot ? [`Those sessions began around ${at(timeToMinutes(slot.startTime))}.`] : []),
        ],
        evidence: targetDays.map((d) => ({
          label: weekdayLabel(d.date),
          value: `${Math.round(exerciseMinutes(d.rows))} of ${EXERCISE_TARGET} minutes`,
        })),
        slot,
        timing: false,
      },
    })
  }

  const keep = bestKeep(keeps, weekAverages(logged), h.usual)
  if (keep) return keep

  // ── Nothing ──
  const counts: [string, number][] = [
    ['Body', logged.filter((d) => calcBody(d.rows) >= METRIC_THRESHOLDS.green).length],
    ['Mind', mindDays.length],
    ['Heart', logged.filter((d) => calcSocial(d.rows) >= METRIC_THRESHOLDS.green).length],
  ]
  // A count of none is an absence, and is left out.
  const reached = counts.filter(([, n]) => n > 0)
  const targets =
    reached.length > 0
      ? `${listJoin(
          reached.map(([name, n], i) => (i === 0 ? `${name} reached its target on ${daysPhrase(n)}` : `${name} on ${n}`))
        )}.`
      : null
  return {
    ...base,
    kind: 'nothing',
    rule: 'week-nothing-ordinary',
    facts: [
      h.hasUsual
        ? 'An ordinary week: its shape matches the four before it.'
        : 'An ordinary week. There is too little history yet to say what is usual.',
      ...(targets ? [targets] : []),
    ],
    evidence: [],
    slot: null,
    timing: false,
  }
}

// ── Words, when the model gives none ──

export function plainReadText(read: Pick<ReviewRead, 'facts'>): string {
  return read.facts.join(' ')
}

// ── The request body the day line is asked with ──

const KINDS: ReadKind[] = ['keep', 'change', 'nothing']
const MAX_FACTS = 6
const MAX_FACT_LENGTH = 240

/** A read as sent by a client: a known kind and 1–6 fact strings, each cut to 240 characters. Anything else is null. */
export function sanitiseRead(input: unknown): { kind: ReadKind; facts: string[] } | null {
  if (!input || typeof input !== 'object') return null
  const { kind, facts } = input as { kind?: unknown; facts?: unknown }
  if (typeof kind !== 'string' || !KINDS.includes(kind as ReadKind)) return null
  if (!Array.isArray(facts) || facts.length < 1 || facts.length > MAX_FACTS) return null
  if (!facts.every((f) => typeof f === 'string' && f.trim().length > 0)) return null
  return { kind: kind as ReadKind, facts: (facts as string[]).map((f) => f.slice(0, MAX_FACT_LENGTH)) }
}

// ── The button ──

export interface BusySpan {
  startMinutes: number
  endMinutes: number
}

export interface ReadActionInput {
  read: ReviewRead
  /** The reviewed day (day review). */
  reviewDate?: string
  /** The week's Monday (weekly review). */
  weekStart?: string
  today: string
  nowMinutes: number
  /** Calendar events and timed planned tasks on today and tomorrow. */
  busyToday: BusySpan[]
  busyTomorrow: BusySpan[]
  /** Titles of the tasks already planned on today and tomorrow. */
  plannedTitles: { today: string[]; tomorrow: string[] }
}

export interface ReadAction {
  label: string
  targetDate: string
  /** Where the button goes. */
  href: string
  /** What tapping it puts into the plan; null → it only opens the planner. */
  slot: ReadSlot | null
  isToday: boolean
}

const STEP = 30
const MAX_SEARCH = 180
const DAY = 24 * 60

function isFree(start: number, length: number, busy: BusySpan[]): boolean {
  const end = start + length
  if (end > DAY) return false
  return !busy.some((b) => b.startMinutes < end && b.endMinutes > start)
}

/** Where a review's one button goes, and what it offers to put into the plan. Writes nothing. */
export function resolveReadAction(input: ReadActionInput): ReadAction {
  const { read, reviewDate, weekStart, today, nowMinutes } = input
  const tomorrow = shiftDateString(today, 1)

  const recent =
    read.scope === 'day'
      ? reviewDate === today || reviewDate === shiftDateString(today, -1)
      : (() => {
          const thisWeek = getWeekStartForDate(today, 1)
          return weekStart === thisWeek || weekStart === shiftDateString(thisWeek, -7)
        })()
  const candidate = recent ? read.slot : null

  const planToday =
    read.scope === 'day' &&
    !!reviewDate &&
    reviewDate < today &&
    nowMinutes < 18 * 60 &&
    (!candidate || timeToMinutes(candidate.startTime) > nowMinutes)
  const targetDate = planToday ? today : tomorrow
  const busy = planToday ? input.busyToday : input.busyTomorrow
  const planned = planToday ? input.plannedTitles.today : input.plannedTitles.tomorrow

  let slot: ReadSlot | null = null
  if (candidate) {
    const already = planned.some(
      (title) => activityMatch(title, candidate.title) >= 1 || activityMatch(candidate.title, title) >= 1
    )
    if (!already) {
      const start = timeToMinutes(candidate.startTime)
      if (read.kind === 'keep') {
        if (isFree(start, candidate.durationMinutes, busy)) slot = candidate
      } else if (read.kind === 'change') {
        for (let s = start; s <= start + MAX_SEARCH; s += STEP) {
          if (planToday && s <= nowMinutes) continue
          if (isFree(s, candidate.durationMinutes, busy)) {
            slot = { ...candidate, startTime: minutesToTime(s) }
            break
          }
        }
      }
    }
  }

  const when = planToday ? 'today' : 'tomorrow'
  return {
    label: slot
      ? `Plan "${slot.title}" at ${at(timeToMinutes(slot.startTime))} ${when}`
      : planToday
        ? 'Plan the rest of today'
        : 'Plan tomorrow',
    targetDate,
    href: planToday ? '/calendar' : `/calendar?date=${targetDate}`,
    slot,
    isToday: planToday,
  }
}
