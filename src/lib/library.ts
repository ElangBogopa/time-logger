/**
 * The research behind the app, in one place.
 *
 * It was in two: /library ("The Science") held a single entry, Zimbardo, and
 * /guide ("Your Ideal Day") held seven more in a list of its own. Both pages
 * sat behind Settings → About, so the most defensible thing in the product —
 * that its numbers come from somewhere — was invisible, and half of it was
 * invisible even to the page claiming to be the library.
 *
 * Each entry says which hero metric it backs, so a metric can link to its own
 * evidence instead of to a page about everything.
 */

import type { MetricKey } from './chart-colors'

export interface LibraryEntry {
  id: string
  kind: 'book' | 'study' | 'paper'
  title: string
  author: string
  year: number
  /** What the work found. */
  finding: string
  /** What the app does about it. Written for the metric it backs. */
  howWeUseIt: string
  link?: string
  /**
   * The hero metrics this entry supports. Empty means it underpins the whole
   * app rather than one number.
   */
  metrics: MetricKey[]
}

export const LIBRARY: LibraryEntry[] = [
  {
    id: 'time-paradox',
    kind: 'book',
    title: 'The Time Paradox',
    author: 'Philip Zimbardo & John Boyd',
    year: 2008,
    finding:
      'People overestimate how much of their time went to productive work by 25–40%. Self-monitoring — simply logging — is the most effective single correction for that bias.',
    howWeUseIt:
      'The reason the app exists. Logging is not bookkeeping: the act of writing a day down is what changes it, because it makes the gap between what you meant to do and what you did impossible to miss.',
    link: 'https://www.amazon.com/Time-Paradox-Psychology-That-Change/dp/1416541993',
    metrics: [],
  },
  {
    id: 'deep-work',
    kind: 'book',
    title: 'Deep Work: Rules for Focused Success',
    author: 'Cal Newport',
    year: 2016,
    finding:
      'Context switching costs up to 40% of productive output, and most people can sustain four to five hours of genuinely focused work a day — not eight.',
    howWeUseIt:
      'Mind targets four hours of deep work, not a full working day, and weights deep work above meetings and admin. Hitting that target scores 80; the curve makes the hours past it worth steadily less.',
    link: 'https://www.amazon.com/Deep-Work-Focused-Success-Distracted/dp/1455586692',
    metrics: ['focus'],
  },
  {
    id: 'who-hours',
    kind: 'study',
    title: 'Long working hours and health outcomes',
    author: 'WHO/ILO Joint Estimates',
    year: 2021,
    finding:
      'Working 55+ hours a week raises stroke risk by 35% and heart disease by 17%. Knowledge work holds up best at 35–40 hours.',
    howWeUseIt:
      'Why Mind saturates instead of rising for ever. A twelve-hour day cannot score much above an eight-hour one, because the evidence does not say it is better.',
    link: 'https://www.who.int/news/item/17-05-2021-long-working-hours-increasing-deaths-from-heart-disease-and-stroke-who-ilo',
    metrics: ['focus'],
  },
  {
    id: 'ultradian',
    kind: 'paper',
    title: 'Basic Rest-Activity Cycle (BRAC)',
    author: 'Nathaniel Kleitman & Ernest Rossi',
    year: 1993,
    finding:
      'Attention runs on 90–120 minute cycles. Blocks of about 90 minutes with a short break after them match the body rather than fighting it.',
    howWeUseIt:
      'Why the day is three sessions rather than one long list, and why the review points at your longest unbroken block instead of your total.',
    metrics: ['focus'],
  },
  {
    id: 'circadian',
    kind: 'paper',
    title: 'Physiology, Circadian Rhythm',
    author: 'Reddy, Reddy & Sharma',
    year: 2023,
    finding:
      'Cognitive performance follows the circadian clock: cortisol peaks at 8–9am and body temperature climbs through the morning, so demanding work lands best early.',
    howWeUseIt:
      'Why morning, afternoon and evening are scored and reviewed separately — the same hour is not worth the same at 9am and 9pm.',
    metrics: ['focus'],
  },
  {
    id: 'harvard-happiness',
    kind: 'study',
    title: 'Harvard Study of Adult Development',
    author: 'Robert Waldinger & Marc Schulz',
    year: 2023,
    finding:
      'Eighty years of follow-up found the quality of someone\'s relationships predicts their well-being better than wealth, fame or career success.',
    howWeUseIt:
      'Why Heart is a metric at all, rather than a footnote under leisure. An hour with people counts as fully as an hour of work, and one hour a day is the target.',
    link: 'https://www.amazon.com/Good-Life-Lessons-Scientific-Happiness/dp/198216669X',
    metrics: ['social'],
  },
  {
    id: 'exercise-cognition',
    kind: 'study',
    title: 'Exercise and Cognitive Performance',
    author: 'Hillman, Erickson & Kramer',
    year: 2008,
    finding:
      'Regular exercise improves executive function, memory and attention, and a single moderate session lifts cognitive performance for hours afterwards.',
    howWeUseIt:
      'Why exercise carries the heaviest weight in Body, and why Body and Mind are shown side by side rather than as rivals for the same hours.',
    link: 'https://doi.org/10.1038/nrn2298',
    metrics: ['body'],
  },
  {
    id: 'leisure-wellbeing',
    kind: 'study',
    title: 'Leisure and Subjective Well-Being',
    author: 'Sharif, Mogilner & Hershfield',
    year: 2021,
    finding:
      'Too little free time (under 2 hours a day) harms well-being about as much as too much (over 5). The useful range is 2–5 hours, and active time beats passive.',
    howWeUseIt:
      'Why rest and self-care count towards Body instead of being ignored, and why the app never tells you that a day with downtime in it was wasted.',
    link: 'https://doi.org/10.1037/pspp0000391',
    metrics: ['body'],
  },
]

/** Entries backing one metric. */
export function entriesForMetric(metric: MetricKey): LibraryEntry[] {
  return LIBRARY.filter((entry) => entry.metrics.includes(metric))
}

/** Entries that underpin the app rather than a single number. */
export function foundationalEntries(): LibraryEntry[] {
  return LIBRARY.filter((entry) => entry.metrics.length === 0)
}
