import { TimeCategory, AggregatedCategory, TimePeriod } from './types'

// ============================================================================
// CORRELATION ENGINE TYPES
// ============================================================================

/** Direction of mood correlation */
export type CorrelationDirection = 'positive' | 'negative'

/** Type of insight generated */
export type InsightType = 'category_presence' | 'category_duration' | 'session_pattern'

/** A single correlation insight */
export interface CorrelationInsight {
  id: string
  type: InsightType
  category: TimeCategory | AggregatedCategory | null
  sessionFrom?: TimePeriod
  sessionTo?: TimePeriod
  direction: CorrelationDirection
  /** Effect size (Cohen's d) — magnitude of difference */
  effectSize: number
  /** Percentage difference in mood score */
  strengthPercent: number
  /** Number of days with the condition present */
  sampleSizeWith: number
  /** Number of days without the condition */
  sampleSizeWithout: number
  /** Human-readable insight description */
  description: string
  /** Average mood score when condition is present (0-2 scale) */
  avgMoodWith: number
  /** Average mood score when condition is absent (0-2 scale) */
  avgMoodWithout: number
  /** Duration threshold in minutes (for duration-based insights) */
  durationThreshold?: number
}

/** Session pattern insight data */
export interface SessionPatternInsight {
  id: string
  fromPeriod: TimePeriod
  toPeriod: TimePeriod
  fromMood: string
  toMoodAvg: number
  sampleSize: number
  description: string
}

/** Full API response */
export interface CorrelationsResponse {
  insights: CorrelationInsight[]
  sessionPatterns: SessionPatternInsight[]
  totalDaysTracked: number
  daysNeeded: number
  hasEnoughData: boolean
}

// Minimum number of days with both mood and activity data
export const MIN_DAYS_FOR_INSIGHTS = 7

// Minimum sample size for a specific condition to be considered
export const MIN_SAMPLE_SIZE = 3

// Mood level numeric values for calculation
export const MOOD_NUMERIC: Record<string, number> = {
  low: 0,
  okay: 1,
  great: 2,
}
