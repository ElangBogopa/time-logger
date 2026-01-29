import { getLocalDateString } from '@/lib/types'

// ── Types ──
export interface EntryRow {
  category: string
  duration_minutes: number
  date: string
}

export interface EssentialDef {
  name: string
  categories: string[]
  threshold: number
}

// ── Category weights for Focus ──
export const FOCUS_WEIGHTS: Record<string, number> = {
  deep_work: 1.0,
  learning: 0.9,
  creating: 0.8,
  shallow_work: 0.3,
}

// ── Balance category groups ──
export const BODY_CATS = ['exercise', 'movement', 'meals']
export const MIND_CATS = ['rest', 'self_care']
export const CONNECTION_CATS = ['social', 'calls']

// ── Default targets ──
export const FOCUS_TARGET = 240 // 4 hours weighted
export const BODY_TARGET = 90   // 90 min
export const MIND_TARGET = 30   // 30 min
export const CONNECTION_TARGET = 30 // 30 min

// ── Rhythm essentials ──
export const ESSENTIALS: EssentialDef[] = [
  { name: 'Deep Work', categories: ['deep_work', 'learning', 'creating'], threshold: 60 },
  { name: 'Movement', categories: ['exercise', 'movement'], threshold: 30 },
  { name: 'Recharge', categories: ['rest', 'self_care', 'meals'], threshold: 20 },
  { name: 'Connect', categories: ['social', 'calls'], threshold: 15 },
]

// ── Color / Label / Nudge thresholds ──
export const FOCUS_THRESHOLDS = { green: 80, yellow: 50 }
export const BALANCE_THRESHOLDS = { green: 70, yellow: 40 }
export const RHYTHM_THRESHOLDS = { green: 75, yellow: 45 }

// ── Pure helpers ──

export function getStatusColor(value: number, thresholds: { green: number; yellow: number }): 'green' | 'yellow' | 'red' {
  if (value >= thresholds.green) return 'green'
  if (value >= thresholds.yellow) return 'yellow'
  return 'red'
}

export function getDateNDaysAgo(baseDate: string, n: number): string {
  const d = new Date(baseDate + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return getLocalDateString(d)
}

export function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

// ── Metric calculation functions ──

/** Calculate Focus value for a set of entries on a single day */
export function calcFocus(dayEntries: EntryRow[]): number {
  let weightedMinutes = 0
  for (const entry of dayEntries) {
    const weight = FOCUS_WEIGHTS[entry.category]
    if (weight) {
      weightedMinutes += entry.duration_minutes * weight
    }
  }
  return Math.round(Math.min(100, (weightedMinutes / FOCUS_TARGET) * 100))
}

/** Get Focus details breakdown for a set of entries */
export function calcFocusDetails(dayEntries: EntryRow[]): { weightedMinutes: number; breakdown: Record<string, number> } {
  let weightedMinutes = 0
  const breakdown: Record<string, number> = {}
  for (const entry of dayEntries) {
    const weight = FOCUS_WEIGHTS[entry.category]
    if (weight) {
      weightedMinutes += entry.duration_minutes * weight
      breakdown[entry.category] = (breakdown[entry.category] || 0) + entry.duration_minutes
    }
  }
  return { weightedMinutes: Math.round(weightedMinutes), breakdown }
}

/** Calculate Balance value for a set of entries on a single day */
export function calcBalance(dayEntries: EntryRow[]): number {
  const sumMinutes = (cats: string[]) =>
    dayEntries.filter(e => cats.includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0)

  const bodyScore = Math.round(Math.min(100, (sumMinutes(BODY_CATS) / BODY_TARGET) * 100))
  const mindScore = Math.round(Math.min(100, (sumMinutes(MIND_CATS) / MIND_TARGET) * 100))
  const connectionScore = Math.round(Math.min(100, (sumMinutes(CONNECTION_CATS) / CONNECTION_TARGET) * 100))

  return Math.round((bodyScore + mindScore + connectionScore) / 3)
}

/** Get Balance details breakdown for a set of entries */
export function calcBalanceDetails(dayEntries: EntryRow[]): {
  body: number; mind: number; connection: number
  bodyMinutes: number; mindMinutes: number; connectionMinutes: number
} {
  const sumMinutes = (cats: string[]) =>
    dayEntries.filter(e => cats.includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0)

  const bodyMinutes = sumMinutes(BODY_CATS)
  const mindMinutes = sumMinutes(MIND_CATS)
  const connectionMinutes = sumMinutes(CONNECTION_CATS)

  return {
    body: Math.round(Math.min(100, (bodyMinutes / BODY_TARGET) * 100)),
    mind: Math.round(Math.min(100, (mindMinutes / MIND_TARGET) * 100)),
    connection: Math.round(Math.min(100, (connectionMinutes / CONNECTION_TARGET) * 100)),
    bodyMinutes,
    mindMinutes,
    connectionMinutes,
  }
}

/** Calculate Rhythm value — 7-day rolling average of daily essentials completion */
export function calcRhythm(entries: EntryRow[], dates: string[]): number {
  const dailyScores: number[] = []

  for (const date of dates) {
    const dayEntries = entries.filter(e => e.date === date)
    let essentialsHit = 0
    for (const essential of ESSENTIALS) {
      const mins = dayEntries
        .filter(e => essential.categories.includes(e.category))
        .reduce((s, e) => s + e.duration_minutes, 0)
      if (mins >= essential.threshold) essentialsHit++
    }
    dailyScores.push(Math.round((essentialsHit / ESSENTIALS.length) * 100))
  }

  if (dailyScores.length === 0) return 0
  return Math.round(dailyScores.reduce((s, d) => s + d, 0) / dailyScores.length)
}

/** Calculate daily rhythm score (single-day essentials percentage) */
export function calcDailyRhythm(dayEntries: EntryRow[]): number {
  let essentialsHit = 0
  for (const essential of ESSENTIALS) {
    const mins = dayEntries
      .filter(e => essential.categories.includes(e.category))
      .reduce((s, e) => s + e.duration_minutes, 0)
    if (mins >= essential.threshold) essentialsHit++
  }
  return Math.round((essentialsHit / ESSENTIALS.length) * 100)
}

/** Get essentials detail for a set of day entries */
export function calcEssentialsDetail(dayEntries: EntryRow[]): Array<{
  name: string; minutes: number; threshold: number; hit: boolean
}> {
  return ESSENTIALS.map(essential => {
    const mins = dayEntries
      .filter(e => essential.categories.includes(e.category))
      .reduce((s, e) => s + e.duration_minutes, 0)
    return { name: essential.name, minutes: mins, threshold: essential.threshold, hit: mins >= essential.threshold }
  })
}

/** Get the status label for a metric */
export function getStatusLabel(metric: 'focus' | 'balance' | 'rhythm', value: number): string {
  if (metric === 'focus') return value >= 80 ? 'Locked in' : value >= 50 ? 'Building' : 'Scattered'
  if (metric === 'balance') return value >= 70 ? 'Recharged' : value >= 40 ? 'Running low' : 'Running on fumes'
  return value >= 75 ? 'Dialed in' : value >= 45 ? 'Getting there' : 'Off track'
}

/** Generate a nudge based on current metric values */
export function getNudge(
  focusValue: number, focusColor: string,
  balanceValue: number, balanceColor: string,
  rhythmValue: number, rhythmColor: string,
): string {
  const metrics = [
    { name: 'Focus', value: focusValue, color: focusColor },
    { name: 'Balance', value: balanceValue, color: balanceColor },
    { name: 'Rhythm', value: rhythmValue, color: rhythmColor },
  ]
  const lowest = metrics.reduce((a, b) => a.value < b.value ? a : b)

  if (lowest.color === 'red') {
    if (lowest.name === 'Focus') return 'Start a deep work block to get Focus moving.'
    if (lowest.name === 'Balance') return 'Take a break — your body and mind need it.'
    return 'Log your essentials to build Rhythm back up.'
  }
  if (lowest.color === 'yellow') {
    if (lowest.name === 'Focus') return 'One more focus session pushes you to green.'
    if (lowest.name === 'Balance') return 'A quick walk or call would boost Balance.'
    return 'Keep showing up — Rhythm builds day by day.'
  }
  return 'All metrics looking strong. Keep it up! 🔥'
}
