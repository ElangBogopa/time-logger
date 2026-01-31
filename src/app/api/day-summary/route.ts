import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { calculateDailyScore, DailyProductivityScore, PlanItem } from '@/lib/productivity-score'
import {
  TimeEntry,
  WeeklyTarget,
  WeeklyTargetType,
  WEEKLY_TARGET_CONFIGS,
  SessionCompletion,
  calculateTargetProgress,
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

interface TargetProgress {
  targetId: string
  targetType: string
  label: string
  todayMinutes: number
  yesterdayMinutes: number
  sameDayLastWeekMinutes: number
  dailyTarget: number
  weeklyTarget: number
  weekMinutes: number
  progress: number
  direction: 'at_least' | 'at_most'
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
  isTargetLinked: boolean // true if user has a target tracking this category
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

  // Target progress
  targetProgress: TargetProgress[]

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
  targetProgress: TargetProgress[],
  sessionsLogged: number,
  totalSessions: number
): number {
  if (targetProgress.length === 0) {
    return Math.round((sessionsLogged / Math.max(totalSessions, 1)) * 100)
  }

  const targetWeight = 0.7
  const sessionWeight = 0.3
  const avgTargetProgress =
    targetProgress.reduce((sum, p) => sum + p.progress, 0) / targetProgress.length
  const sessionScore = (sessionsLogged / Math.max(totalSessions, 1)) * 100

  return Math.round(avgTargetProgress * targetWeight + sessionScore * sessionWeight)
}

function getScoreColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 70) return 'green'
  if (score >= 40) return 'orange'
  return 'red'
}

function generateWins(
  entries: TimeEntry[],
  targetProgress: TargetProgress[],
  longestFocus: { activity: string; minutes: number } | null,
  categoryBreakdown: CategoryBreakdown[]
): Win[] {
  const wins: Win[] = []

  // Check for goals met
  for (const tp of targetProgress) {
    if (tp.direction === 'at_least' && tp.progress >= 100) {
      wins.push({
        id: `goal-${tp.targetId}`,
        text: `Hit your ${tp.label.toLowerCase()} goal`,
        type: 'goal_met',
        value: tp.todayMinutes,
      })
    } else if (tp.direction === 'at_most' && tp.progress >= 100) {
      wins.push({
        id: `goal-${tp.targetId}`,
        text: `Stayed under your ${tp.label.toLowerCase()} limit`,
        type: 'goal_met',
        value: tp.todayMinutes,
      })
    }
  }

  // Check for improvements vs yesterday
  for (const tp of targetProgress) {
    if (tp.trend === 'up' && tp.progress < 100) {
      const diff = tp.direction === 'at_least'
        ? tp.todayMinutes - tp.yesterdayMinutes
        : tp.yesterdayMinutes - tp.todayMinutes
      if (diff > 15) { // At least 15 min improvement
        wins.push({
          id: `improve-${tp.targetId}`,
          text: `${Math.round(diff)} min ${tp.direction === 'at_least' ? 'more' : 'less'} ${tp.label.toLowerCase()} than yesterday`,
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

  // No entertainment (if tracking leisure limit)
  const entertainmentEntry = categoryBreakdown.find(c => c.category === 'entertainment')
  if (!entertainmentEntry || entertainmentEntry.minutes === 0) {
    const hasLeisureTarget = targetProgress.some(t => t.targetType === 'leisure')
    if (hasLeisureTarget) {
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
  targets: WeeklyTarget[]
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

  // Determine which aggregated categories are linked to user targets
  const targetLinkedCategories = new Set<AggregatedCategory>()
  for (const target of targets) {
    const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
    if (!config) continue
    for (const cat of config.categories) {
      // Find which aggregated category this belongs to
      for (const [aggCat, group] of Object.entries(ENERGY_VIEW)) {
        if (group.categories.includes(cat)) {
          targetLinkedCategories.add(aggCat as AggregatedCategory)
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
      isTargetLinked: targetLinkedCategories.has(aggCat),
    })
  }

  // Sort by minutes descending, but keep target-linked ones prominent
  breakdown.sort((a, b) => {
    // Target-linked with time first
    if (a.isTargetLinked && a.minutes > 0 && !(b.isTargetLinked && b.minutes > 0)) return -1
    if (b.isTargetLinked && b.minutes > 0 && !(a.isTargetLinked && a.minutes > 0)) return 1
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
  const dateParam = request.nextUrl.searchParams.get('date')
  // Always prefer client-provided date — server may be in UTC (Vercel)
  const today = dateParam || getUserToday()
  const isViewingToday = !dateParam || today === getUserToday()
  const yesterday = getYesterdayDateString(today)
  const sameDayLastWeek = getSameDayLastWeek(today)
  const weekDates = getWeekDates(today)
  const currentHour = getUserCurrentHour()

  // For past dates, all sessions have passed
  const sessionsPassed = isViewingToday
    ? (currentHour >= 24 ? 3 : currentHour >= 18 ? 3 : currentHour >= 12 ? 2 : 1)
    : 3
  const hasEveningPassed = isViewingToday ? currentHour >= 21 : true

  try {
    const [
      todayEntriesResult,
      yesterdayEntriesResult,
      lastWeekEntriesResult,
      weekEntriesResult,
      targetsResult,
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
        .from('weekly_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('sort_order'),

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
    const yesterdayEntries = (yesterdayEntriesResult.data || []) as TimeEntry[]
    const lastWeekEntries = (lastWeekEntriesResult.data || []) as TimeEntry[]
    const weekEntries = (weekEntriesResult.data || []) as TimeEntry[]
    const targets = (targetsResult.data || []) as WeeklyTarget[]
    const completions = (completionsResult.data || []) as SessionCompletion[]
    const todayMood = (moodResult.data?.[0] as MoodCheckin) || null
    const todayPlans = (plansResult.data || []) as PlanItem[]

    // Calculate productivity score from plans
    const productivityScore = todayPlans.length > 0 ? calculateDailyScore(todayPlans) : null

    const totalMinutesLogged = todayEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const sessionsLogged = completions.filter(c => !c.skipped).length

    // Calculate target progress with same day last week comparison
    const targetProgress: TargetProgress[] = targets.map(target => {
      const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
      if (!config) {
        return {
          targetId: target.id,
          targetType: target.target_type,
          label: target.target_type,
          todayMinutes: 0,
          yesterdayMinutes: 0,
          sameDayLastWeekMinutes: 0,
          dailyTarget: 0,
          weeklyTarget: target.weekly_target_minutes,
          weekMinutes: 0,
          progress: 0,
          direction: target.direction as 'at_least' | 'at_most',
          trend: 'same' as const,
          vsLastWeekTrend: 'same' as const,
        }
      }

      const categories = config.categories
      const weeklyTarget = target.weekly_target_minutes
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

      const progress = calculateTargetProgress(todayMinutes, dailyTarget, target.direction as 'at_least' | 'at_most')

      let trend: 'up' | 'down' | 'same'
      if (target.direction === 'at_least') {
        trend = todayMinutes > yesterdayMinutes ? 'up' : todayMinutes < yesterdayMinutes ? 'down' : 'same'
      } else {
        // at_most: less is better
        trend = todayMinutes < yesterdayMinutes ? 'up' : todayMinutes > yesterdayMinutes ? 'down' : 'same'
      }

      let vsLastWeekTrend: 'up' | 'down' | 'same'
      if (target.direction === 'at_least') {
        vsLastWeekTrend = todayMinutes > sameDayLastWeekMinutes ? 'up' : todayMinutes < sameDayLastWeekMinutes ? 'down' : 'same'
      } else {
        vsLastWeekTrend = todayMinutes < sameDayLastWeekMinutes ? 'up' : todayMinutes > sameDayLastWeekMinutes ? 'down' : 'same'
      }

      return {
        targetId: target.id,
        targetType: target.target_type,
        label: config.label,
        todayMinutes,
        yesterdayMinutes,
        sameDayLastWeekMinutes,
        dailyTarget,
        weeklyTarget,
        weekMinutes,
        progress,
        direction: target.direction as 'at_least' | 'at_most',
        trend,
        vsLastWeekTrend,
      }
    })

    const score = calculateDayScore(targetProgress, sessionsLogged, sessionsPassed)
    const scoreColor = getScoreColor(score)

    // Build additional data
    const timeline = buildTimeline(todayEntries)
    const longestFocusSession = findLongestFocusSession(todayEntries)
    const categoryBreakdown = buildCategoryBreakdown(todayEntries)
    const aggregatedBreakdown = buildAggregatedBreakdown(todayEntries, targets)
    const wins = generateWins(todayEntries, targetProgress, longestFocusSession, categoryBreakdown)

    const summary: DaySummary = {
      score,
      scoreColor,
      sessionsLogged,
      totalSessions: sessionsPassed,
      totalMinutesLogged,
      hasEveningPassed,
      date: today,
      targetProgress,
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
