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

// ── Category weights for Mind ──
// Anything without a weight scores nothing, which left meetings worth zero:
// six hours of client calls scored 0 while six hours of email scored 45%.
// That ranks a working day backwards. Meetings are real cognitive work, but
// someone else sets the agenda, so they sit below your own deep work.
export const FOCUS_WEIGHTS: Record<string, number> = {
  deep_work: 1.0,
  learning: 0.9,
  creating: 0.8,
  meetings: 0.5,
  shallow_work: 0.3,
}

// ── Body category groups ──
// Body is "did you look after yourself", not "did you train". Sleeping,
// eating and washing are how a body is kept, and leaving them out produced
// days like 3 Nov 2026: showered, two meals, a haircut, seven hours of work,
// and a Body of 22 labelled "Running on empty" because there was no gym.
// sleep and meals also fed no metric at all before this — the same hole
// meetings had in Mind.
// 'movement' is merged into 'exercise' in scoring; old entries still work.
export const BODY_CATS = ['exercise', 'movement', 'rest', 'self_care', 'sleep', 'meals']

// ── Body category weights ──
// Weighted minutes, summed linearly; the shared curve supplies the
// diminishing returns, so there are no per-category targets or caps here any
// more. An hour of exercise is still exactly the target, so training alone
// reaches 80 as it always did — but a night's sleep plus ordinary upkeep now
// gets there too, which is the point of a metric called Body rather than
// Training.
export const BODY_WEIGHTS: Record<string, { weight: number }> = {
  exercise:  { weight: 0.80 },  // 60 min is the target on its own
  self_care: { weight: 0.40 },  // washing, grooming, therapy, meditation
  rest:      { weight: 0.25 },  // deliberate downtime
  meals:     { weight: 0.10 },  // eating is upkeep; duration is a weak proxy, so it is light
  sleep:     { weight: 0.05 },  // 8 hours is about half the target on its own
}

// ── Heart category groups ──
// Faith sits here rather than under Body: prayer is not physical upkeep, and
// the third metric is about what sustains you, not only who you saw. It is
// additive — an hour with friends still maxes the metric on its own, so no
// one is penalised for having no faith.
export const SOCIAL_CATS = ['social', 'calls', 'faith']

/**
 * What the three hero metrics are called.
 *
 * The keys are 'body' | 'focus' | 'social' throughout the API, the stored
 * trend data and the client caches; only the display names changed, so old
 * payloads keep working. Body / Mind / Heart.
 */
export const METRIC_LABELS = {
  body: 'Body',
  focus: 'Mind',
  social: 'Heart',
} as const

// ── Default targets ──
// Targets are the load that scores 80. See saturatingScore.
export const FOCUS_TARGET = 240 // 4 hours of deep work, or the weighted equivalent
export const BODY_TARGET = 48   // an hour of exercise at weight 0.80
export const SOCIAL_TARGET = 60 // 1 hour with people, or in prayer

// ── Color / Label / Nudge thresholds ──
// Green is 80 on all three now, because 80 means the same thing on all three:
// you hit the target. Yellow at 50 is roughly 43% of it.
export const FOCUS_THRESHOLDS = { green: 80, yellow: 50 }
export const BODY_THRESHOLDS = { green: 80, yellow: 50 }
export const SOCIAL_THRESHOLDS = { green: 80, yellow: 50 }

/**
 * Load → score, the Whoop way: accumulate load linearly, show it on a scale
 * that gets harder the further you go.
 *
 *   score = 100 × (1 − e^(−k · load / target)),  k = ln 5
 *
 * k is chosen so that hitting the target lands exactly on 80, which gives the
 * number a meaning it never had while the scale was linear: 80 is "you did
 * what you set out to do", not an arbitrary line. Past that it saturates —
 * double the target is 96, triple is 99 — and 100 is an asymptote, so the
 * display is clamped at 99 and a perfect score is unreachable by design.
 *
 * Load stays linear everywhere else, so the breakdowns still add up and a
 * detail sheet can explain a score in minutes.
 */
const SATURATION_K = Math.log(5) // ≈ 1.609: target → 80
export const MAX_SCORE = 99

export function saturatingScore(load: number, target: number): number {
  if (load <= 0 || target <= 0) return 0
  const score = 100 * (1 - Math.exp((-SATURATION_K * load) / target))
  return Math.min(MAX_SCORE, Math.round(score))
}

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
  return saturatingScore(weightedMinutes, FOCUS_TARGET)
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

/**
 * Calculate Body value using weighted categories with diminishing returns (sqrt scaling).
 * Each category has a weight, individual target, and a cap on max contribution.
 * 
 * Scoring examples (approximate):
 * - 30min exercise alone → ~28%
 * - 60min exercise alone → ~35% (capped at 40%)
 * - 30min exercise + 30min movement → ~48%
 * - 60min exercise + 45min movement + 20min self_care + 15min rest → ~85%
 * - Getting to 100% requires exceeding targets across ALL categories
 */
export function calcBody(dayEntries: EntryRow[]): number {
  // Sum minutes per body category — merge 'movement' into 'exercise'
  const minutesByCategory: Record<string, number> = {}
  for (const entry of dayEntries) {
    if (BODY_CATS.includes(entry.category)) {
      const cat = entry.category === 'movement' ? 'exercise' : entry.category
      minutesByCategory[cat] = (minutesByCategory[cat] || 0) + entry.duration_minutes
    }
  }

  // Weighted minutes, summed linearly. The per-category sqrt and caps that
  // used to live here are gone: the shared curve now provides the diminishing
  // returns, and doing it in both places damps twice.
  let weightedMinutes = 0
  for (const [cat, config] of Object.entries(BODY_WEIGHTS)) {
    weightedMinutes += (minutesByCategory[cat] || 0) * config.weight
  }

  return saturatingScore(weightedMinutes, BODY_TARGET)
}

/** Get Body details breakdown for a set of entries */
export function calcBodyDetails(dayEntries: EntryRow[]): {
  totalMinutes: number
  breakdown: Record<string, number>
  categoryScores: Record<string, number>
} {
  let totalMinutes = 0
  const breakdown: Record<string, number> = {}
  for (const entry of dayEntries) {
    if (BODY_CATS.includes(entry.category)) {
      totalMinutes += entry.duration_minutes
      // Merge movement into exercise for display
      const cat = entry.category === 'movement' ? 'exercise' : entry.category
      breakdown[cat] = (breakdown[cat] || 0) + entry.duration_minutes
    }
  }

  // Per-category contribution on the same scale as the headline score, so the
  // breakdown explains it. This still used the old sqrt-and-caps maths after
  // calcBody moved to the shared curve, so the parts stopped adding up.
  const categoryScores: Record<string, number> = {}
  for (const [cat, config] of Object.entries(BODY_WEIGHTS)) {
    const minutes = breakdown[cat] || 0
    categoryScores[cat] = saturatingScore(minutes * config.weight, BODY_TARGET)
  }

  return { totalMinutes, breakdown, categoryScores }
}

/** Calculate Social value for a set of entries on a single day */
export function calcSocial(dayEntries: EntryRow[]): number {
  const socialMinutes = dayEntries
    .filter(e => SOCIAL_CATS.includes(e.category))
    .reduce((s, e) => s + e.duration_minutes, 0)

  return saturatingScore(socialMinutes, SOCIAL_TARGET)
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
    { name: METRIC_LABELS.body, value: bodyValue, color: bodyColor },
    { name: METRIC_LABELS.focus, value: focusValue, color: focusColor },
    { name: METRIC_LABELS.social, value: socialValue, color: socialColor },
  ]
  const lowest = metrics.reduce((a, b) => a.value < b.value ? a : b)

  if (lowest.color === 'red') {
    if (lowest.name === METRIC_LABELS.body) return 'Move your body — even a short walk counts.'
    if (lowest.name === METRIC_LABELS.focus) return 'Start a deep work block to get Mind moving.'
    return 'Reach out to someone — even a quick call counts.'
  }
  if (lowest.color === 'yellow') {
    if (lowest.name === METRIC_LABELS.body) return 'A walk or a real break would boost Body.'
    if (lowest.name === METRIC_LABELS.focus) return 'One more focus session pushes you to green.'
    return 'Make time for people today — Heart is slipping.'
  }
  return 'All metrics looking strong. Keep it up! 🔥'
}
