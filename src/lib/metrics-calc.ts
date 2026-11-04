import { getLocalDateString } from '@/lib/types'

// ── Types ──
export interface EntryRow {
  category: string
  duration_minutes: number
  date: string
  /** Used to judge how hard a session was; absent rows fall back to the category. */
  activity?: string
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

/**
 * ── Body ──
 *
 * Body is exercise, plus upkeep, and the two are not interchangeable. The
 * old version summed them into one pot: eight hours of sleep, three meals
 * and a shower came to 45 weighted minutes against a target of 48, which
 * scored 78 on a day with no exercise in it. A metric called Body should
 * not say that.
 *
 * So the score is now a weighted sum of two separate scores, and upkeep's
 * share is capped below the point where a day without training can look
 * like a strong one:
 *
 *   body = 0.75 × exercise + 0.45 × upkeep       (each 0–99, then capped)
 *
 * which puts a day of perfect upkeep and no exercise at 45, a 45-minute
 * moderate session on its own at 60, and that session with ordinary upkeep
 * in the 85–95 range. Change those two shares to move the ceiling.
 */
export const EXERCISE_SHARE = 0.75
export const UPKEEP_SHARE = 0.45

/**
 * Exercise is counted in moderate-equivalent minutes, the way the physical
 * activity guidelines do it: WHO asks for 150 minutes of moderate OR 75 of
 * vigorous a week, so vigorous is worth double. Light movement — a stroll,
 * stretching — is real but not the same thing, so it is worth half.
 */
export const INTENSITY_MULTIPLIER = { vigorous: 2, moderate: 1, light: 0.5 } as const
export type Intensity = keyof typeof INTENSITY_MULTIPLIER

/** ≥6 METs: hard enough that holding a conversation is work. */
const VIGOROUS_WORDS = [
  'run', 'running', 'jog', 'sprint', 'hiit', 'interval', 'spin', 'spinning',
  'boxing', 'box', 'crossfit', 'circuit', 'football', 'soccer', 'basketball',
  'squash', 'tennis', 'rugby', 'swim', 'swimming', 'rowing', 'row', 'skipping',
  'burpees', 'bootcamp', 'muay thai', 'mma', 'sparring', 'climb', 'climbing',
]

/** <3 METs: moving, but not training. */
const LIGHT_WORDS = [
  'walk', 'walking', 'stroll', 'stretch', 'stretching', 'mobility', 'foam roll',
  'yin', 'restorative', 'pilates mat', 'tai chi', 'dog',
]

/**
 * How hard a session was, from what it was called. An entry in `exercise`
 * with nothing recognisable is treated as moderate — the honest default,
 * since the person called it exercise.
 */
export function classifyIntensity(category: string, activity?: string): Intensity {
  const text = (activity || '').toLowerCase()
  const hit = (words: string[]) => words.some((word) => new RegExp(`\\b${word}\\b`).test(text))

  if (hit(VIGOROUS_WORDS)) return 'vigorous'
  if (hit(LIGHT_WORDS)) return 'light'
  return category === 'movement' ? 'light' : 'moderate'
}

/** Moderate-equivalent minutes of exercise in a day. */
export function exerciseMinutes(dayEntries: EntryRow[]): number {
  let minutes = 0
  for (const entry of dayEntries) {
    if (entry.category !== 'exercise' && entry.category !== 'movement') continue
    minutes += entry.duration_minutes * INTENSITY_MULTIPLIER[classifyIntensity(entry.category, entry.activity)]
  }
  return minutes
}

/**
 * Upkeep: looking after yourself in the ways that are not training. The
 * relative weights are unchanged — a shower counts for more per minute than
 * a meal, and sleep is counted lightly because eight hours of it is normal
 * rather than an achievement.
 */
export const UPKEEP_WEIGHTS: Record<string, number> = {
  self_care: 0.40,
  rest: 0.25,
  meals: 0.10,
  sleep: 0.05,
}

export function upkeepMinutes(dayEntries: EntryRow[]): number {
  let minutes = 0
  for (const entry of dayEntries) {
    const weight = UPKEEP_WEIGHTS[entry.category]
    if (weight) minutes += entry.duration_minutes * weight
  }
  return minutes
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
/** Moderate-equivalent minutes that score 80 on the exercise half. */
export const EXERCISE_TARGET = 45
/** Weighted upkeep minutes that score 80 on the upkeep half: roughly a
 *  night's sleep, three meals and half an hour of looking after yourself. */
export const UPKEEP_TARGET = 48
/** @deprecated kept so older callers still compile; Body no longer has one target. */
export const BODY_TARGET = 48
export const SOCIAL_TARGET = 60 // 1 hour with people, or in prayer

// ── Color / Label / Nudge thresholds ──
// Green is 80 on all three now, because 80 means the same thing on all three:
// you hit the target. Yellow at 50 is roughly 43% of it.
export const METRIC_THRESHOLDS = { green: 80, yellow: 50 }
// The three names are kept because the routes read one per metric, but there
// is one line to change. chart-colors.ts used to carry its own 70/40 pair, so
// a weekly bar turned green ten points before the ring it came from did.
export const FOCUS_THRESHOLDS = METRIC_THRESHOLDS
export const BODY_THRESHOLDS = METRIC_THRESHOLDS
export const SOCIAL_THRESHOLDS = METRIC_THRESHOLDS

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

/**
 * A day reduced to one number, for the places that can only show one.
 *
 * It is how many of Body, Mind and Heart reached their target that day — 0
 * to 3 — rather than an average of the three. Averaging three saturating
 * scores puts almost every real day in the middle: hitting the deep-work
 * target and nothing else gives 80, 0, 0 → 27, which reads as a bad day when
 * it was a focused one. Counting targets says something true at a glance and
 * needs no threshold of its own: it reuses the 80 that already means "you
 * did what you set out to do".
 */
export function countMetricsOnTarget(dayEntries: EntryRow[]): number {
  const scores = [calcBody(dayEntries), calcFocus(dayEntries), calcSocial(dayEntries)]
  return scores.filter((score) => score >= METRIC_THRESHOLDS.green).length
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
 * Body = exercise, plus upkeep, with upkeep unable to carry a day on its own.
 *
 *   0.75 × exercise score + 0.45 × upkeep score, capped at MAX_SCORE
 *
 * Worked examples:
 *   8h sleep, 3 meals, a shower, no exercise → 41   (was 78)
 *   45 min moderate session, nothing else    → 60
 *   that session plus the upkeep above       → 94
 *   20 min run, nothing else                 → 48
 */
export function calcBody(dayEntries: EntryRow[]): number {
  const exercise = saturatingScore(exerciseMinutes(dayEntries), EXERCISE_TARGET)
  const upkeep = saturatingScore(upkeepMinutes(dayEntries), UPKEEP_TARGET)
  return Math.min(MAX_SCORE, Math.round(EXERCISE_SHARE * exercise + UPKEEP_SHARE * upkeep))
}

/**
 * The two halves of Body, so the detail sheet can explain the number: how
 * many moderate-equivalent minutes of exercise, and what upkeep added.
 */
export function calcBodyDetails(dayEntries: EntryRow[]): {
  totalMinutes: number
  breakdown: Record<string, number>
  categoryScores: Record<string, number>
  exerciseScore: number
  upkeepScore: number
  moderateEquivalentMinutes: number
  intensities: Record<string, number>
} {
  let totalMinutes = 0
  const breakdown: Record<string, number> = {}
  const intensities: Record<string, number> = {}

  for (const entry of dayEntries) {
    if (!BODY_CATS.includes(entry.category)) continue
    totalMinutes += entry.duration_minutes
    const cat = entry.category === 'movement' ? 'exercise' : entry.category
    breakdown[cat] = (breakdown[cat] || 0) + entry.duration_minutes
    if (entry.category === 'exercise' || entry.category === 'movement') {
      const intensity = classifyIntensity(entry.category, entry.activity)
      intensities[intensity] = (intensities[intensity] || 0) + entry.duration_minutes
    }
  }

  const moderateEquivalentMinutes = Math.round(exerciseMinutes(dayEntries))
  const exerciseScore = saturatingScore(moderateEquivalentMinutes, EXERCISE_TARGET)
  const upkeepScore = saturatingScore(upkeepMinutes(dayEntries), UPKEEP_TARGET)

  /**
   * What each row contributes to the headline, on the headline's own scale.
   *
   * Upkeep's share is split between its categories in proportion to their
   * weighted minutes, rather than each being curved on its own and the
   * results added: four categories each scored through a saturating curve
   * and then summed overshot the headline by more than fifty points, which
   * is a breakdown that explains nothing.
   */
  const categoryScores: Record<string, number> = {
    exercise: Math.round(EXERCISE_SHARE * exerciseScore),
  }
  const upkeepContribution = UPKEEP_SHARE * upkeepScore
  const totalUpkeepWeighted = upkeepMinutes(dayEntries)
  for (const [cat, weight] of Object.entries(UPKEEP_WEIGHTS)) {
    const weighted = (breakdown[cat] || 0) * weight
    categoryScores[cat] =
      totalUpkeepWeighted > 0
        ? Math.round(upkeepContribution * (weighted / totalUpkeepWeighted))
        : 0
  }

  return {
    totalMinutes,
    breakdown,
    categoryScores,
    exerciseScore,
    upkeepScore,
    moderateEquivalentMinutes,
    intensities,
  }
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
  return 'All three metrics are strong today.'
}
