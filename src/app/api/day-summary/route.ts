import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  TimeEntry,
  UserIntention,
  SessionCompletion,
  INTENTION_CONFIGS,
  INTENTION_CATEGORY_MAP,
  getLocalDateString,
  getUserToday,
  getUserCurrentHour,
  calculateIntentionProgress,
  TimeCategory,
  CATEGORY_LABELS,
  MoodCheckin,
  AggregatedCategory,
  ENERGY_VIEW,
  AGGREGATED_CATEGORY_LABELS,
  aggregateByView,
} from '@/lib/types'

interface IntentionProgress {
  intentionId: string
  intentionType: string
  label: string
  todayMinutes: number
  yesterdayMinutes: number
  sameDayLastWeekMinutes: number
  dailyTarget: number
  weeklyTarget: number
  weekMinutes: number
  progress: number
  direction: 'maximize' | 'minimize'
  trend: 'up' | 'down' | 'same'
  vsLastWeekTrend: 'up' | 'down' | 'same'
}

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
  isIntentionLinked: boolean // true if user has an intention tracking this category
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

  // Intention progress
  intentionProgress: IntentionProgress[]

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
}

function getYesterdayDateString(userToday: string): string {
  const todayDate = new Date(userToday + 'T12:00:00')
  todayDate.setDate(todayDate.getDate() - 1)
  return getLocalDateString(todayDate)
}

function getSameDayLastWeek(userToday: string): string {
  const todayDate = new Date(userToday + 'T12:00:00')
  todayDate.setDate(todayDate.getDate() - 7)
  return getLocalDateString(todayDate)
}

function getWeekDates(userToday: string): string[] {
  const todayDate = new Date(userToday + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const dates: string[] = []
  for (let i = 0; i <= (dayOfWeek === 0 ? 6 : dayOfWeek - 1); i++) {
    const date = new Date(todayDate)
    date.setDate(date.getDate() - daysToSubtract + i)
    dates.push(getLocalDateString(date))
  }
  if (!dates.includes(userToday)) {
    dates.push(userToday)
  }
  return dates
}

function calculateDayScore(
  intentionProgress: IntentionProgress[],
  sessionsLogged: number,
  totalSessions: number
): number {
  if (intentionProgress.length === 0) {
    return Math.round((sessionsLogged / Math.max(totalSessions, 1)) * 100)
  }

  const intentionWeight = 0.7
  const sessionWeight = 0.3
  const avgIntentionProgress =
    intentionProgress.reduce((sum, p) => sum + p.progress, 0) / intentionProgress.length
  const sessionScore = (sessionsLogged / Math.max(totalSessions, 1)) * 100

  return Math.round(avgIntentionProgress * intentionWeight + sessionScore * sessionWeight)
}

function getScoreColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 70) return 'green'
  if (score >= 40) return 'orange'
  return 'red'
}

function generateWins(
  entries: TimeEntry[],
  intentionProgress: IntentionProgress[],
  longestFocus: { activity: string; minutes: number } | null,
  categoryBreakdown: CategoryBreakdown[]
): Win[] {
  const wins: Win[] = []

  // Check for goals met
  for (const intention of intentionProgress) {
    if (intention.direction === 'maximize' && intention.progress >= 100) {
      wins.push({
        id: `goal-${intention.intentionId}`,
        text: `Hit your ${intention.label.toLowerCase()} goal`,
        type: 'goal_met',
        value: intention.todayMinutes,
      })
    } else if (intention.direction === 'minimize' && intention.progress >= 100) {
      wins.push({
        id: `goal-${intention.intentionId}`,
        text: `Stayed under your ${intention.label.toLowerCase()} limit`,
        type: 'goal_met',
        value: intention.todayMinutes,
      })
    }
  }

  // Check for improvements vs yesterday
  for (const intention of intentionProgress) {
    if (intention.trend === 'up' && intention.progress < 100) {
      const diff = intention.direction === 'maximize'
        ? intention.todayMinutes - intention.yesterdayMinutes
        : intention.yesterdayMinutes - intention.todayMinutes
      if (diff > 15) { // At least 15 min improvement
        wins.push({
          id: `improve-${intention.intentionId}`,
          text: `${Math.round(diff)} min ${intention.direction === 'maximize' ? 'more' : 'less'} ${intention.label.toLowerCase()} than yesterday`,
          type: 'improvement',
          value: diff,
        })
      }
    }
  }

  // Longest focus session
  if (longestFocus && longestFocus.minutes >= 60) {
    wins.push({
      id: 'longest-focus',
      text: `${longestFocus.minutes} min focus session on "${longestFocus.activity}"`,
      type: 'focus',
      value: longestFocus.minutes,
    })
  }

  // No entertainment/distractions (if tracking less distractions)
  const entertainmentEntry = categoryBreakdown.find(c => c.category === 'entertainment')
  if (!entertainmentEntry || entertainmentEntry.minutes === 0) {
    const hasLessDistraction = intentionProgress.some(i => i.intentionType === 'less_distraction')
    if (hasLessDistraction) {
      wins.push({
        id: 'no-distraction',
        text: 'Zero leisure/entertainment logged today',
        type: 'balance',
      })
    }
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
  intentions: UserIntention[]
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

  // Determine which aggregated categories are linked to user intentions
  const intentionLinkedCategories = new Set<AggregatedCategory>()
  for (const intention of intentions) {
    const intentionCategories = INTENTION_CATEGORY_MAP[intention.intention_type] || []
    for (const cat of intentionCategories) {
      // Find which aggregated category this belongs to
      for (const [aggCat, group] of Object.entries(ENERGY_VIEW)) {
        if (group.categories.includes(cat)) {
          intentionLinkedCategories.add(aggCat as AggregatedCategory)
        }
      }
    }
  }

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
      isIntentionLinked: intentionLinkedCategories.has(aggCat),
    })
  }

  // Sort by minutes descending, but keep intention-linked ones prominent
  breakdown.sort((a, b) => {
    // Intention-linked with time first
    if (a.isIntentionLinked && a.minutes > 0 && !(b.isIntentionLinked && b.minutes > 0)) return -1
    if (b.isIntentionLinked && b.minutes > 0 && !(a.isIntentionLinked && a.minutes > 0)) return 1
    // Then by minutes
    return b.minutes - a.minutes
  })

  return breakdown
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const today = getUserToday()
  const yesterday = getYesterdayDateString(today)
  const sameDayLastWeek = getSameDayLastWeek(today)
  const weekDates = getWeekDates(today)
  const currentHour = getUserCurrentHour()

  const sessionsPassed = currentHour >= 24 ? 3 : currentHour >= 18 ? 3 : currentHour >= 12 ? 2 : 1
  const hasEveningPassed = currentHour >= 21

  try {
    const [
      todayEntriesResult,
      yesterdayEntriesResult,
      lastWeekEntriesResult,
      weekEntriesResult,
      intentionsResult,
      completionsResult,
      moodResult,
    ] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('status', 'confirmed')
        .order('start_time'),

      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', yesterday)
        .eq('status', 'confirmed'),

      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', sameDayLastWeek)
        .eq('status', 'confirmed'),

      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .in('date', weekDates)
        .eq('status', 'confirmed'),

      supabase
        .from('user_intentions')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('priority'),

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
    ])

    const todayEntries = (todayEntriesResult.data || []) as TimeEntry[]
    const yesterdayEntries = (yesterdayEntriesResult.data || []) as TimeEntry[]
    const lastWeekEntries = (lastWeekEntriesResult.data || []) as TimeEntry[]
    const weekEntries = (weekEntriesResult.data || []) as TimeEntry[]
    const intentions = (intentionsResult.data || []) as UserIntention[]
    const completions = (completionsResult.data || []) as SessionCompletion[]
    const todayMood = (moodResult.data?.[0] as MoodCheckin) || null

    const totalMinutesLogged = todayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const sessionsLogged = completions.filter(c => !c.skipped).length

    // Calculate intention progress with same day last week comparison
    const intentionProgress: IntentionProgress[] = intentions.map(intention => {
      const config = INTENTION_CONFIGS[intention.intention_type]
      const categories = INTENTION_CATEGORY_MAP[intention.intention_type]
      const weeklyTarget = intention.weekly_target_minutes || config.defaultTargetMinutes
      const dailyTarget = Math.round(weeklyTarget / 7)

      const todayMinutes = todayEntries
        .filter(e => e.category && categories.includes(e.category))
        .reduce((sum, e) => sum + e.duration_minutes, 0)

      const yesterdayMinutes = yesterdayEntries
        .filter(e => e.category && categories.includes(e.category))
        .reduce((sum, e) => sum + e.duration_minutes, 0)

      const sameDayLastWeekMinutes = lastWeekEntries
        .filter(e => e.category && categories.includes(e.category))
        .reduce((sum, e) => sum + e.duration_minutes, 0)

      const weekMinutes = weekEntries
        .filter(e => e.category && categories.includes(e.category))
        .reduce((sum, e) => sum + e.duration_minutes, 0)

      const progress = calculateIntentionProgress(todayMinutes, dailyTarget, config.direction)

      let trend: 'up' | 'down' | 'same'
      if (config.direction === 'maximize') {
        trend = todayMinutes > yesterdayMinutes ? 'up' : todayMinutes < yesterdayMinutes ? 'down' : 'same'
      } else {
        trend = todayMinutes < yesterdayMinutes ? 'up' : todayMinutes > yesterdayMinutes ? 'down' : 'same'
      }

      let vsLastWeekTrend: 'up' | 'down' | 'same'
      if (config.direction === 'maximize') {
        vsLastWeekTrend = todayMinutes > sameDayLastWeekMinutes ? 'up' : todayMinutes < sameDayLastWeekMinutes ? 'down' : 'same'
      } else {
        vsLastWeekTrend = todayMinutes < sameDayLastWeekMinutes ? 'up' : todayMinutes > sameDayLastWeekMinutes ? 'down' : 'same'
      }

      return {
        intentionId: intention.id,
        intentionType: intention.intention_type,
        label: config.label,
        todayMinutes,
        yesterdayMinutes,
        sameDayLastWeekMinutes,
        dailyTarget,
        weeklyTarget,
        weekMinutes,
        progress,
        direction: config.direction,
        trend,
        vsLastWeekTrend,
      }
    })

    const score = calculateDayScore(intentionProgress, sessionsLogged, sessionsPassed)
    const scoreColor = getScoreColor(score)

    // Build additional data
    const timeline = buildTimeline(todayEntries)
    const longestFocusSession = findLongestFocusSession(todayEntries)
    const categoryBreakdown = buildCategoryBreakdown(todayEntries)
    const aggregatedBreakdown = buildAggregatedBreakdown(todayEntries, intentions)
    const wins = generateWins(todayEntries, intentionProgress, longestFocusSession, categoryBreakdown)

    const summary: DaySummary = {
      score,
      scoreColor,
      sessionsLogged,
      totalSessions: sessionsPassed,
      totalMinutesLogged,
      hasEveningPassed,
      date: today,
      intentionProgress,
      wins,
      timeline,
      longestFocusSession,
      categoryBreakdown,
      aggregatedBreakdown,
      todayMood,
      entries: todayEntries,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching day summary:', error)
    return NextResponse.json({ error: 'Failed to fetch day summary' }, { status: 500 })
  }
}
