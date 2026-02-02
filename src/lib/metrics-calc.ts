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

// ── Body category groups ──
export const BODY_CATS = ['exercise', 'movement', 'meals', 'rest', 'self_care', 'sleep']

// ── Social category groups ──
export const SOCIAL_CATS = ['social', 'calls']

// ── Default targets ──
export const FOCUS_TARGET = 240 // 4 hours weighted
export const BODY_TARGET = 120  // 2 hours (exercise + meals + rest + self-care)
export const SOCIAL_TARGET = 60 // 1 hour

// ── Color / Label / Nudge thresholds ──
export const FOCUS_THRESHOLDS = { green: 80, yellow: 50 }
export const BODY_THRESHOLDS = { green: 70, yellow: 40 }
export const SOCIAL_THRESHOLDS = { green: 70, yellow: 35 }

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

/** Calculate Body value for a set of entries on a single day */
export function calcBody(dayEntries: EntryRow[]): number {
  const bodyMinutes = dayEntries
    .filter(e => BODY_CATS.includes(e.category))
    .reduce((s, e) => s + e.duration_minutes, 0)

  return Math.round(Math.min(100, (bodyMinutes / BODY_TARGET) * 100))
}

/** Get Body details breakdown for a set of entries */
export function calcBodyDetails(dayEntries: EntryRow[]): {
  totalMinutes: number
  breakdown: Record<string, number>
} {
  let totalMinutes = 0
  const breakdown: Record<string, number> = {}
  for (const entry of dayEntries) {
    if (BODY_CATS.includes(entry.category)) {
      totalMinutes += entry.duration_minutes
      breakdown[entry.category] = (breakdown[entry.category] || 0) + entry.duration_minutes
    }
  }
  return { totalMinutes, breakdown }
}

/** Calculate Social value for a set of entries on a single day */
export function calcSocial(dayEntries: EntryRow[]): number {
  const socialMinutes = dayEntries
    .filter(e => SOCIAL_CATS.includes(e.category))
    .reduce((s, e) => s + e.duration_minutes, 0)

  return Math.round(Math.min(100, (socialMinutes / SOCIAL_TARGET) * 100))
}

/** Get Social details breakdown for a set of entries */
export function calcSocialDetails(dayEntries: EntryRow[]): {
  totalMinutes: number
  breakdown: Record<string, number>
} {
  let totalMinutes = 0
  const breakdown: Record<string, number> = {}
  for (const entry of dayEntries) {
    if (SOCIAL_CATS.includes(entry.category)) {
      totalMinutes += entry.duration_minutes
      breakdown[entry.category] = (breakdown[entry.category] || 0) + entry.duration_minutes
    }
  }
  return { totalMinutes, breakdown }
}

/** Get the status label for a metric */
export function getStatusLabel(metric: 'body' | 'focus' | 'social', value: number): string {
  if (metric === 'body') return value >= 70 ? 'Fueled up' : value >= 40 ? 'Running low' : 'Running on empty'
  if (metric === 'focus') return value >= 80 ? 'Locked in' : value >= 50 ? 'Building' : 'Scattered'
  return value >= 70 ? 'Connected' : value >= 35 ? 'Reaching out' : 'Isolated'
}

/** Generate a nudge based on current metric values */
export function getNudge(
  bodyValue: number, bodyColor: string,
  focusValue: number, focusColor: string,
  socialValue: number, socialColor: string,
): string {
  const metrics = [
    { name: 'Body', value: bodyValue, color: bodyColor },
    { name: 'Focus', value: focusValue, color: focusColor },
    { name: 'Social', value: socialValue, color: socialColor },
  ]
  const lowest = metrics.reduce((a, b) => a.value < b.value ? a : b)

  if (lowest.color === 'red') {
    if (lowest.name === 'Body') return 'Move your body or grab a proper meal — you need it.'
    if (lowest.name === 'Focus') return 'Start a deep work block to get Focus moving.'
    return 'Reach out to someone — even a quick call counts.'
  }
  if (lowest.color === 'yellow') {
    if (lowest.name === 'Body') return 'A walk or a real break would boost Body.'
    if (lowest.name === 'Focus') return 'One more focus session pushes you to green.'
    return 'Make time for people today — Social is slipping.'
  }
  return 'All metrics looking strong. Keep it up! 🔥'
}
