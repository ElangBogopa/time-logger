import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import {
  TimeCategory,
  TimeEntry,
  MoodCheckin,
  TimePeriod,
  CATEGORY_LABELS,
  ENERGY_VIEW,
  AggregatedCategory,
} from '@/lib/types'
import {
  CorrelationInsight,
  SessionPatternInsight,
  CorrelationsResponse,
  InsightType,
  CorrelationDirection,
  MIN_DAYS_FOR_INSIGHTS,
  MIN_SAMPLE_SIZE,
  MOOD_NUMERIC,
} from '@/lib/correlation-types'

// ============================================================================
// STATISTICAL HELPERS
// ============================================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squareDiffs = values.map(v => (v - avg) ** 2)
  return Math.sqrt(squareDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1))
}

/** Cohen's d — effect size as difference in means / pooled std dev */
function cohensD(group1: number[], group2: number[]): number {
  if (group1.length < 2 || group2.length < 2) return 0
  const m1 = mean(group1)
  const m2 = mean(group2)
  const sd1 = stdDev(group1)
  const sd2 = stdDev(group2)

  // Pooled standard deviation
  const n1 = group1.length
  const n2 = group2.length
  const pooledSD = Math.sqrt(
    ((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2)
  )

  if (pooledSD === 0) return 0
  return (m1 - m2) / pooledSD
}

function moodToNumeric(mood: string): number {
  return MOOD_NUMERIC[mood] ?? 1
}

function generateInsightId(type: string, ...parts: string[]): string {
  return `${type}:${parts.join(':')}`
}

// ============================================================================
// DATA PROCESSING
// ============================================================================

interface DayData {
  date: string
  entries: TimeEntry[]
  moods: MoodCheckin[]
  /** Average mood score across all sessions for this day (0-2) */
  avgMoodScore: number
  /** Category minutes map */
  categoryMinutes: Map<TimeCategory, number>
  /** Aggregated category minutes map */
  aggregatedMinutes: Map<AggregatedCategory, number>
  /** Total minutes logged */
  totalMinutes: number
}

function buildDayData(
  entries: TimeEntry[],
  moods: MoodCheckin[]
): Map<string, DayData> {
  const dayMap = new Map<string, DayData>()

  // Collect all dates from entries and moods
  const allDates = new Set<string>()
  entries.forEach(e => allDates.add(e.date))
  moods.forEach(m => allDates.add(m.date))

  for (const date of allDates) {
    const dayEntries = entries.filter(e => e.date === date && e.status === 'confirmed')
    const dayMoods = moods.filter(m => m.date === date)

    if (dayMoods.length === 0) continue // Need mood data to correlate

    const moodScores = dayMoods.map(m => moodToNumeric(m.mood))
    const avgMoodScore = mean(moodScores)

    // Calculate category minutes
    const categoryMinutes = new Map<TimeCategory, number>()
    let totalMinutes = 0
    for (const entry of dayEntries) {
      if (entry.category) {
        const current = categoryMinutes.get(entry.category) || 0
        categoryMinutes.set(entry.category, current + entry.duration_minutes)
        totalMinutes += entry.duration_minutes
      }
    }

    // Calculate aggregated category minutes
    const aggregatedMinutes = new Map<AggregatedCategory, number>()
    for (const [aggCat, group] of Object.entries(ENERGY_VIEW)) {
      let catTotal = 0
      for (const cat of group.categories) {
        catTotal += categoryMinutes.get(cat) || 0
      }
      if (catTotal > 0) {
        aggregatedMinutes.set(aggCat as AggregatedCategory, catTotal)
      }
    }

    dayMap.set(date, {
      date,
      entries: dayEntries,
      moods: dayMoods,
      avgMoodScore,
      categoryMinutes,
      aggregatedMinutes,
      totalMinutes,
    })
  }

  return dayMap
}

// ============================================================================
// INSIGHT GENERATORS
// ============================================================================

/** Per-category: avg mood on days WITH category vs days WITHOUT */
function generateCategoryPresenceInsights(
  dayData: Map<string, DayData>
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []
  const days = Array.from(dayData.values())

  // Check each individual category
  const allCategories = Object.keys(CATEGORY_LABELS) as TimeCategory[]

  for (const category of allCategories) {
    const daysWith = days.filter(d => (d.categoryMinutes.get(category) || 0) > 0)
    const daysWithout = days.filter(d => (d.categoryMinutes.get(category) || 0) === 0)

    if (daysWith.length < MIN_SAMPLE_SIZE || daysWithout.length < MIN_SAMPLE_SIZE) continue

    const moodsWith = daysWith.map(d => d.avgMoodScore)
    const moodsWithout = daysWithout.map(d => d.avgMoodScore)

    const avgWith = mean(moodsWith)
    const avgWithout = mean(moodsWithout)
    const effectSize = cohensD(moodsWith, moodsWithout)

    // Only include if effect size is meaningful (|d| > 0.2 = small effect)
    if (Math.abs(effectSize) < 0.2) continue

    const percentDiff = avgWithout > 0
      ? Math.round(((avgWith - avgWithout) / avgWithout) * 100)
      : avgWith > avgWithout ? 100 : -100

    const direction: CorrelationDirection = effectSize > 0 ? 'positive' : 'negative'
    const label = CATEGORY_LABELS[category]

    const description = direction === 'positive'
      ? `Your mood is ${Math.abs(percentDiff)}% higher on days when you do ${label.toLowerCase()}`
      : `Your mood tends to be ${Math.abs(percentDiff)}% lower on days with ${label.toLowerCase()}`

    insights.push({
      id: generateInsightId('presence', category),
      type: 'category_presence' as InsightType,
      category,
      direction,
      effectSize: Math.abs(effectSize),
      strengthPercent: Math.abs(percentDiff),
      sampleSizeWith: daysWith.length,
      sampleSizeWithout: daysWithout.length,
      description,
      avgMoodWith: avgWith,
      avgMoodWithout: avgWithout,
    })
  }

  return insights
}

/** Duration-based: does 2+ hours of X correlate with higher/lower mood? */
function generateDurationInsights(
  dayData: Map<string, DayData>
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []
  const days = Array.from(dayData.values())

  // Check aggregated categories for duration thresholds
  const aggCategories = Object.keys(ENERGY_VIEW) as AggregatedCategory[]
  const thresholds = [60, 120] // 1 hour, 2 hours

  for (const aggCat of aggCategories) {
    for (const threshold of thresholds) {
      const daysWith = days.filter(d => (d.aggregatedMinutes.get(aggCat) || 0) >= threshold)
      const daysWithout = days.filter(d => (d.aggregatedMinutes.get(aggCat) || 0) < threshold)

      if (daysWith.length < MIN_SAMPLE_SIZE || daysWithout.length < MIN_SAMPLE_SIZE) continue

      const moodsWith = daysWith.map(d => d.avgMoodScore)
      const moodsWithout = daysWithout.map(d => d.avgMoodScore)

      const avgWith = mean(moodsWith)
      const avgWithout = mean(moodsWithout)
      const effectSize = cohensD(moodsWith, moodsWithout)

      if (Math.abs(effectSize) < 0.2) continue

      const percentDiff = avgWithout > 0
        ? Math.round(((avgWith - avgWithout) / avgWithout) * 100)
        : avgWith > avgWithout ? 100 : -100

      const direction: CorrelationDirection = effectSize > 0 ? 'positive' : 'negative'
      const label = ENERGY_VIEW[aggCat].label
      const hours = threshold / 60

      const description = direction === 'positive'
        ? `Your mood is ${Math.abs(percentDiff)}% higher on days with ${hours}+ hours of ${label.toLowerCase()}`
        : `Your mood tends to be ${Math.abs(percentDiff)}% lower on days with ${hours}+ hours of ${label.toLowerCase()}`

      insights.push({
        id: generateInsightId('duration', aggCat, String(threshold)),
        type: 'category_duration' as InsightType,
        category: aggCat,
        direction,
        effectSize: Math.abs(effectSize),
        strengthPercent: Math.abs(percentDiff),
        sampleSizeWith: daysWith.length,
        sampleSizeWithout: daysWithout.length,
        description,
        avgMoodWith: avgWith,
        avgMoodWithout: avgWithout,
        durationThreshold: threshold,
      })
    }
  }

  return insights
}

/** Session patterns: how morning activities affect afternoon mood, etc. */
function generateSessionPatterns(
  dayData: Map<string, DayData>
): SessionPatternInsight[] {
  const patterns: SessionPatternInsight[] = []
  const days = Array.from(dayData.values())

  const periodPairs: Array<{ from: TimePeriod; to: TimePeriod }> = [
    { from: 'morning', to: 'afternoon' },
    { from: 'afternoon', to: 'evening' },
    { from: 'morning', to: 'evening' },
  ]

  const moodLevels = ['low', 'okay', 'great'] as const

  for (const { from, to } of periodPairs) {
    for (const fromMood of moodLevels) {
      // Find days where the "from" period has this mood
      const matchingDays = days.filter(d => {
        const fromMoodEntry = d.moods.find(m => m.period === from)
        const toMoodEntry = d.moods.find(m => m.period === to)
        return fromMoodEntry?.mood === fromMood && toMoodEntry !== undefined
      })

      if (matchingDays.length < MIN_SAMPLE_SIZE) continue

      const toMoods = matchingDays.map(d => {
        const toMoodEntry = d.moods.find(m => m.period === to)!
        return moodToNumeric(toMoodEntry.mood)
      })

      const avgToMood = mean(toMoods)

      const fromLabel = from.charAt(0).toUpperCase() + from.slice(1)
      const toLabel = to.charAt(0).toUpperCase() + to.slice(1)
      const moodLabel = fromMood === 'great' ? 'energized' : fromMood === 'low' ? 'low energy' : 'steady'
      const toMoodLabel = avgToMood >= 1.5 ? 'great' : avgToMood >= 0.5 ? 'okay' : 'low'

      const description = `When your ${fromLabel.toLowerCase()} starts ${moodLabel}, your ${toLabel.toLowerCase()} mood tends to be ${toMoodLabel}`

      patterns.push({
        id: generateInsightId('session', from, to, fromMood),
        fromPeriod: from,
        toPeriod: to,
        fromMood,
        toMoodAvg: avgToMood,
        sampleSize: matchingDays.length,
        description,
      })
    }
  }

  return patterns
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all mood check-ins and time entries for this user
    const [moodResult, entriesResult] = await Promise.all([
      supabase
        .from('mood_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true }),
      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .order('date', { ascending: true }),
    ])

    if (moodResult.error) {
      console.error('Error fetching mood data:', moodResult.error)
      return NextResponse.json({ error: 'Failed to fetch mood data' }, { status: 500 })
    }

    if (entriesResult.error) {
      console.error('Error fetching entries data:', entriesResult.error)
      return NextResponse.json({ error: 'Failed to fetch entries data' }, { status: 500 })
    }

    const moods = (moodResult.data || []) as MoodCheckin[]
    const entries = (entriesResult.data || []) as TimeEntry[]

    // Build per-day data structures
    const dayData = buildDayData(entries, moods)
    const totalDaysTracked = dayData.size

    // Check if we have enough data
    if (totalDaysTracked < MIN_DAYS_FOR_INSIGHTS) {
      const response: CorrelationsResponse = {
        insights: [],
        sessionPatterns: [],
        totalDaysTracked,
        daysNeeded: MIN_DAYS_FOR_INSIGHTS - totalDaysTracked,
        hasEnoughData: false,
      }
      return NextResponse.json(response)
    }

    // Generate all insights
    const presenceInsights = generateCategoryPresenceInsights(dayData)
    const durationInsights = generateDurationInsights(dayData)
    const sessionPatterns = generateSessionPatterns(dayData)

    // Combine and deduplicate insights (prefer stronger effect sizes)
    const allInsights = [...presenceInsights, ...durationInsights]

    // Deduplicate: for same category, keep only the strongest insight
    const bestInsightByCategory = new Map<string, CorrelationInsight>()
    for (const insight of allInsights) {
      const key = insight.category || 'none'
      const existing = bestInsightByCategory.get(key)
      if (!existing || insight.effectSize > existing.effectSize) {
        bestInsightByCategory.set(key, insight)
      }
    }

    // Also keep duration insights if they're notably stronger than presence ones
    for (const insight of durationInsights) {
      const key = `duration:${insight.category}`
      const presenceKey = insight.category || 'none'
      const presenceInsight = bestInsightByCategory.get(presenceKey)

      // Keep duration insight if it's at least 20% stronger than presence insight
      if (!presenceInsight || insight.effectSize > presenceInsight.effectSize * 1.2) {
        bestInsightByCategory.set(key, insight)
      }
    }

    const sortedInsights = Array.from(bestInsightByCategory.values())
      .sort((a, b) => b.effectSize - a.effectSize)

    const response: CorrelationsResponse = {
      insights: sortedInsights,
      sessionPatterns: sessionPatterns.sort((a, b) => b.sampleSize - a.sampleSize),
      totalDaysTracked,
      daysNeeded: 0,
      hasEnoughData: true,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in GET /api/correlations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
