import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { calculateDailyScore, DailyProductivityScore, PlanItem } from '@/lib/productivity-score'
import {
  TimeEntry,
  SessionCompletion,
  getLocalDateString,
  getUserToday,
  getUserCurrentHour,
  TimeCategory,
  CATEGORY_LABELS,
  MoodCheckin,
  AggregatedCategory,
  ENERGY_VIEW,
  AGGREGATED_CATEGORY_LABELS,
  aggregateByView,
} from '@/lib/types'

interface Win {
  id: string
  text: string
  type: 'goal_met' | 'streak' | 'focus' | 'improvement' | 'balance'
  value?: number
}

interface TimelineBlock {
  hour: number
  entries: {
    id: string
    activity: string
    category: TimeCategory | null
    startTime: string
    endTime: string
    durationMinutes: number
  }[]
  totalMinutes: number
}

interface CategoryBreakdown {
  category: TimeCategory
  label: string
  minutes: number
  percentage: number
}

interface AggregatedBreakdown {
  category: AggregatedCategory
  label: string
  minutes: number
  percentage: number
}

interface DaySummary {
  // Core metrics
  score: number
  scoreColor: 'green' | 'orange' | 'red'
  sessionsLogged: number
  totalSessions: number
  totalMinutesLogged: number
  hasEveningPassed: boolean
  date: string

  // Wins
  wins: Win[]

  // Timeline
  timeline: TimelineBlock[]
  longestFocusSession: { activity: string; minutes: number } | null

  // Category breakdown (granular)
  categoryBreakdown: CategoryBreakdown[]

  // Aggregated breakdown (6 energy categories)
  aggregatedBreakdown: AggregatedBreakdown[]

  // Mood
  todayMood: MoodCheckin | null

  // Entries for detailed view
  entries: TimeEntry[]

  // Productivity plan score (plan-based scoring)
  productivityScore: DailyProductivityScore | null
}

function calculateDayScore(
  sessionsLogged: number,
  totalSessions: number
): number {
  return Math.round((sessionsLogged / Math.max(totalSessions, 1)) * 100)
}

function getScoreColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 70) return 'green'
  if (score >= 40) return 'orange'
  return 'red'
}

function generateWins(
  entries: TimeEntry[],
  longestFocus: { activity: string; minutes: number } | null,
  categoryBreakdown: CategoryBreakdown[]
): Win[] {
  const wins: Win[] = []

  // Longest focus session
  if (longestFocus && longestFocus.minutes >= 60) {
    wins.push({
      id: 'longest-focus',
      text: `${longestFocus.minutes} min focus session on "${longestFocus.activity}"`,
      type: 'focus',
      value: longestFocus.minutes,
    })
  }

  // Good balance of categories
  const hasDeepWork = categoryBreakdown.some(c => c.category === 'deep_work' && c.minutes >= 60)
  const hasRest = categoryBreakdown.some(c => (c.category === 'rest' || c.category === 'self_care') && c.minutes >= 30)
  if (hasDeepWork && hasRest) {
    wins.push({
      id: 'balance',
      text: 'Good balance of focus and rest',
      type: 'balance',
    })
  }

  return wins.slice(0, 5) // Max 5 wins
}

function buildTimeline(entries: TimeEntry[]): TimelineBlock[] {
  const timeline: TimelineBlock[] = []

  // Initialize all 24 hours
  for (let hour = 0; hour < 24; hour++) {
    timeline.push({ hour, entries: [], totalMinutes: 0 })
  }

  // Place entries into hours based on start time
  for (const entry of entries) {
    if (!entry.start_time) continue

    const startHour = parseInt(entry.start_time.split(':')[0])
    if (startHour >= 0 && startHour < 24) {
      timeline[startHour].entries.push({
        id: entry.id,
        activity: entry.activity,
        category: entry.category,
        startTime: entry.start_time,
        endTime: entry.end_time || entry.start_time,
        durationMinutes: entry.duration_minutes,
      })
      timeline[startHour].totalMinutes += entry.duration_minutes
    }
  }

  return timeline
}

function findLongestFocusSession(entries: TimeEntry[]): { activity: string; minutes: number } | null {
  const focusCategories: TimeCategory[] = ['deep_work', 'learning']
  const focusEntries = entries.filter(e => e.category && focusCategories.includes(e.category))

  if (focusEntries.length === 0) return null

  const longest = focusEntries.reduce((max, e) =>
    e.duration_minutes > max.duration_minutes ? e : max
  )

  return {
    activity: longest.activity,
    minutes: longest.duration_minutes,
  }
}

function buildCategoryBreakdown(entries: TimeEntry[]): CategoryBreakdown[] {
  const categoryMinutes = new Map<TimeCategory, number>()
  let totalMinutes = 0

  for (const entry of entries) {
    if (entry.category) {
      const current = categoryMinutes.get(entry.category) || 0
      categoryMinutes.set(entry.category, current + entry.duration_minutes)
      totalMinutes += entry.duration_minutes
    }
  }

  const breakdown: CategoryBreakdown[] = []
  for (const [category, minutes] of categoryMinutes) {
    breakdown.push({
      category,
      label: CATEGORY_LABELS[category],
      minutes,
      percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
    })
  }

  // Sort by minutes descending
  breakdown.sort((a, b) => b.minutes - a.minutes)
  return breakdown
}

function buildAggregatedBreakdown(
  entries: TimeEntry[],
): AggregatedBreakdown[] {
  // Build category minutes map
  const categoryMinutes = new Map<TimeCategory, number>()
  let totalMinutes = 0

  for (const entry of entries) {
    if (entry.category) {
      const current = categoryMinutes.get(entry.category) || 0
      categoryMinutes.set(entry.category, current + entry.duration_minutes)
      totalMinutes += entry.duration_minutes
    }
  }

  // Aggregate using the energy view
  const aggregated = aggregateByView(categoryMinutes, ENERGY_VIEW)

  // Build breakdown with all 6 categories (even if 0 minutes)
  const breakdown: AggregatedBreakdown[] = []
  const aggCategories: AggregatedCategory[] = ['focus', 'ops', 'body', 'recovery', 'connection', 'escape']

  for (const aggCat of aggCategories) {
    const minutes = aggregated.get(aggCat) || 0
    breakdown.push({
      category: aggCat,
      label: AGGREGATED_CATEGORY_LABELS[aggCat],
      minutes,
      percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
    })
  }

  // Sort by minutes descending
  breakdown.sort((a, b) => b.minutes - a.minutes)

  return breakdown
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const dateParam = request.nextUrl.searchParams.get('date')
  // Always prefer client-provided date — server may be in UTC (Vercel)
  const today = dateParam || getUserToday()
  const isViewingToday = !dateParam || dateParam === getUserToday()
  const currentHour = getUserCurrentHour()

  // For past dates, all sessions have passed
  const sessionsPassed = isViewingToday
    ? (currentHour >= 24 ? 3 : currentHour >= 18 ? 3 : currentHour >= 12 ? 2 : 1)
    : 3
  const hasEveningPassed = isViewingToday ? currentHour >= 21 : true

  try {
    const [
      todayEntriesResult,
      completionsResult,
      moodResult,
      plansResult,
    ] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('status', 'confirmed')
        .order('start_time'),

      supabase
        .from('session_completions')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today),

      supabase
        .from('mood_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1),

      supabase
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .order('sort_order', { ascending: true }),
    ])

    const todayEntries = (todayEntriesResult.data || []) as TimeEntry[]
    const completions = (completionsResult.data || []) as SessionCompletion[]
    const todayMood = (moodResult.data?.[0] as MoodCheckin) || null
    const todayPlans = (plansResult.data || []) as PlanItem[]

    // Calculate productivity score from plans
    const productivityScore = todayPlans.length > 0 ? calculateDailyScore(todayPlans) : null

    const totalMinutesLogged = todayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const sessionsLogged = completions.filter(c => !c.skipped).length

    const score = calculateDayScore(sessionsLogged, sessionsPassed)
    const scoreColor = getScoreColor(score)

    // Build additional data
    const timeline = buildTimeline(todayEntries)
    const longestFocusSession = findLongestFocusSession(todayEntries)
    const categoryBreakdown = buildCategoryBreakdown(todayEntries)
    const aggregatedBreakdown = buildAggregatedBreakdown(todayEntries)
    const wins = generateWins(todayEntries, longestFocusSession, categoryBreakdown)

    const summary: DaySummary = {
      score,
      scoreColor,
      sessionsLogged,
      totalSessions: sessionsPassed,
      totalMinutesLogged,
      hasEveningPassed,
      date: today,
      wins,
      timeline,
      longestFocusSession,
      categoryBreakdown,
      aggregatedBreakdown,
      todayMood,
      entries: todayEntries,
      productivityScore,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching day summary:', error)
    return NextResponse.json({ error: 'Failed to fetch day summary' }, { status: 500 })
  }
}
