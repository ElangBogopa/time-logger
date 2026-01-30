import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  WeeklyTarget,
  WeeklyTargetType,
  WEEKLY_TARGET_CONFIGS,
  calculateTargetProgress,
  getTargetFeedback,
} from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

const MIN_ENTRIES_FOR_REVIEW = 7

interface WeeklyReviewRequest {
  weekStart: string // YYYY-MM-DD of the Sunday
  timezone?: string // IANA timezone (e.g., 'America/New_York')
}

interface TargetProgress {
  target: WeeklyTarget
  label: string
  currentMinutes: number
  targetMinutes: number
  percentage: number | null
  trend: 'up' | 'down' | 'same' | null
  previousMinutes: number | null
  isLimitTarget: boolean // For at_most targets
  changeMinutes: number | null // Difference from last week
  improvementPercentage: number | null // For limit targets
  // Research-based feedback
  feedbackMessage: string | null
  feedbackTone: 'success' | 'warning' | 'neutral' | 'danger' | null
  researchNote: string | null
  optimalRangeMin: number | null
  optimalRangeMax: number | null
}

interface CategoryBreakdown {
  category: TimeCategory
  label: string
  minutes: number
  percentage: number
  entryCount: number
}

type DayRating = 'good' | 'neutral' | 'rough' | 'no_data'

interface TargetDayScore {
  date: string
  day: string // 'Mon', 'Tue', etc.
  rating: DayRating
  targetMinutes: number
  hadDistraction: boolean // For leisure limit targets
}

interface TargetScorecard {
  targetId: string
  targetLabel: string
  isLimitTarget: boolean
  days: TargetDayScore[]
  goodDays: number
  roughDays: number
}

interface WeekHighlight {
  type: 'streak' | 'improvement' | 'target_hit' | 'personal_best' | 'consistency'
  icon: string
  text: string
  subtext?: string
}

interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  // New hero metrics
  weekScore: number // 0-100
  weekScoreLabel: string // "Strong week", "Good progress", etc.
  activeDays: number // Days with entries
  evaluatedDays: number // Days included in review (excludes today for current week)
  highlights: WeekHighlight[]
  // Existing
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean // Current week has >= 7 entries
  hasPreviousWeekData: boolean // Previous week has >= 7 entries
  targetProgress: TargetProgress[]
  targetScorecards: TargetScorecard[]
  categoryBreakdown: CategoryBreakdown[]
  bestDays: string[]
  bestHours: string[]
  insights: string[]
  coachSummary: string | null
}

// Get today's date in a specific timezone (YYYY-MM-DD)
function getTodayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

// Get Sunday (start) of a given week for a date in a timezone
function getWeekStart(dateStr: string): string {
  // Parse date as local date
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay() // 0 = Sunday
  date.setDate(date.getDate() - dayOfWeek)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Get Saturday (end) of a given week
function getWeekEnd(weekStart: string): string {
  const [year, month, day] = weekStart.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + 6)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Get the previous week's Sunday
function getPreviousWeekStart(weekStart: string): string {
  const [year, month, day] = weekStart.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Format hour to readable string
function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

// Get day name from date
function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

// Get short day name
function getShortDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `weekly-review:${ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const { weekStart: requestedWeekStart, timezone }: WeeklyReviewRequest = await request.json()

    // Require timezone from client - no defaults
    if (!timezone) {
      return NextResponse.json(
        { error: 'Timezone parameter is required' },
        { status: 400 }
      )
    }

    const today = getTodayInTimezone(timezone)
    const weekStart = requestedWeekStart || getWeekStart(today)
    const weekEnd = getWeekEnd(weekStart)
    const previousWeekStart = getPreviousWeekStart(weekStart)
    const previousWeekEnd = getWeekEnd(previousWeekStart)

    // For the current week, exclude today since the day hasn't ended yet
    // (daily review isn't ready). Use yesterday as the effective end date.
    const currentWeekStart = getWeekStart(today)
    const isCurrentWeek = weekStart === currentWeekStart
    let effectiveEndDate = weekEnd
    if (isCurrentWeek) {
      // Get yesterday's date in the user's timezone
      const todayDate = new Date(today + 'T12:00:00') // noon to avoid DST edge cases
      todayDate.setDate(todayDate.getDate() - 1)
      const y = todayDate.getFullYear()
      const m = String(todayDate.getMonth() + 1).padStart(2, '0')
      const d = String(todayDate.getDate()).padStart(2, '0')
      const yesterday = `${y}-${m}-${d}`
      // Only exclude today if yesterday is still within or after the week start
      // (handles edge case of viewing on the first day of the week)
      if (yesterday >= weekStart) {
        effectiveEndDate = yesterday
      }
      // If today IS the first day (Sunday), effectiveEndDate stays as weekEnd
      // but there won't be prior-day data anyway — show what's available
    }

    // Fetch current week entries (up to effectiveEndDate)
    const { data: currentWeekEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', weekStart)
      .lte('date', effectiveEndDate)
      .order('date', { ascending: true })

    // Fetch previous week entries
    const { data: previousWeekEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', previousWeekStart)
      .lte('date', previousWeekEnd)

    // Fetch user's weekly targets
    const { data: userTargets } = await supabase
      .from('weekly_targets')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    const entries = (currentWeekEntries || []) as TimeEntry[]
    const prevEntries = (previousWeekEntries || []) as TimeEntry[]
    const targets = (userTargets || []) as WeeklyTarget[]

    const entryCount = entries.length
    const previousWeekEntryCount = prevEntries.length
    const hasEnoughData = entryCount >= MIN_ENTRIES_FOR_REVIEW
    const hasPreviousWeekData = previousWeekEntryCount >= MIN_ENTRIES_FOR_REVIEW

    // Calculate totals
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const previousWeekMinutes = hasPreviousWeekData
      ? prevEntries.reduce((sum, e) => sum + e.duration_minutes, 0)
      : null

    // Calculate category breakdown
    const categoryMap = new Map<TimeCategory, { minutes: number; count: number }>()
    entries.forEach((entry) => {
      if (entry.category) {
        const current = categoryMap.get(entry.category) || { minutes: 0, count: 0 }
        categoryMap.set(entry.category, {
          minutes: current.minutes + entry.duration_minutes,
          count: current.count + 1,
        })
      }
    })

    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        label: CATEGORY_LABELS[category],
        minutes: data.minutes,
        percentage: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0,
        entryCount: data.count,
      }))
      .sort((a, b) => b.minutes - a.minutes)

    // Calculate previous week category totals
    const prevCategoryMap = new Map<TimeCategory, number>()
    prevEntries.forEach((entry) => {
      if (entry.category) {
        const current = prevCategoryMap.get(entry.category) || 0
        prevCategoryMap.set(entry.category, current + entry.duration_minutes)
      }
    })

    // Calculate entries by day for scorecard
    // Only include days up to effectiveEndDate (excludes today for current week)
    const entriesByDay = new Map<string, TimeEntry[]>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + 'T00:00:00')
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      if (dateStr > effectiveEndDate) break
      entriesByDay.set(dateStr, [])
    }
    entries.forEach((entry) => {
      const dayEntries = entriesByDay.get(entry.date)
      if (dayEntries) {
        dayEntries.push(entry)
      }
    })

    // Calculate target progress
    const targetProgress: TargetProgress[] = targets.map((target) => {
      const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
      const isLimitTarget = target.direction === 'at_most'
      let currentMinutes = 0
      let previousMinutes = 0

      if (config) {
        config.categories.forEach((cat) => {
          currentMinutes += categoryMap.get(cat)?.minutes || 0
          previousMinutes += prevCategoryMap.get(cat) || 0
        })
      }

      const targetMinutes = target.weekly_target_minutes

      // Calculate progress percentage
      let percentage: number | null = null
      let improvementPercentage: number | null = null

      if (isLimitTarget && hasPreviousWeekData && previousMinutes > 0) {
        // Improvement = how much we reduced (positive = good)
        improvementPercentage = Math.round(((previousMinutes - currentMinutes) / previousMinutes) * 100)
        percentage = improvementPercentage
      } else if (!isLimitTarget && targetMinutes) {
        percentage = calculateTargetProgress(currentMinutes, targetMinutes, target.direction as 'at_least' | 'at_most')
      }

      // Get research-based feedback
      const feedback = config
        ? getTargetFeedback(currentMinutes, targetMinutes, target.direction as 'at_least' | 'at_most')
        : null

      // Trend calculation
      let trend: 'up' | 'down' | 'same' | null = null
      let changeMinutes: number | null = null

      if (hasPreviousWeekData && previousMinutes > 0) {
        changeMinutes = currentMinutes - previousMinutes
        const threshold = previousMinutes * 0.1

        if (Math.abs(changeMinutes) < threshold) {
          trend = 'same'
        } else if (changeMinutes > 0) {
          trend = 'up'
        } else {
          trend = 'down'
        }
      }

      return {
        target,
        label: config ? config.label : target.target_type,
        currentMinutes,
        targetMinutes,
        percentage,
        trend,
        previousMinutes: hasPreviousWeekData ? previousMinutes : null,
        isLimitTarget,
        changeMinutes: hasPreviousWeekData ? changeMinutes : null,
        improvementPercentage,
        // Add research-based feedback
        feedbackMessage: feedback?.message || null,
        feedbackTone: feedback?.tone || null,
        researchNote: config?.researchNote || null,
        optimalRangeMin: config?.minMinutes || null,
        optimalRangeMax: config?.maxMinutes || null,
      }
    })

    // Build target scorecards
    const targetScorecards: TargetScorecard[] = targets.map((target) => {
      const config = WEEKLY_TARGET_CONFIGS[target.target_type as WeeklyTargetType]
      const isLimitTarget = target.direction === 'at_most'
      const targetMinutes = target.weekly_target_minutes
      const dailyTarget = targetMinutes / (evaluatedDays || 7)

      const days: TargetDayScore[] = []
      let goodDays = 0
      let roughDays = 0

      Array.from(entriesByDay.entries()).forEach(([date, dayEntries]) => {
        let dayTargetMinutes = 0
        let hadDistraction = false

        dayEntries.forEach((entry) => {
          if (config && entry.category && config.categories.includes(entry.category)) {
            dayTargetMinutes += entry.duration_minutes
            if (isLimitTarget) {
              hadDistraction = true
            }
          }
        })

        let rating: DayRating = 'no_data'

        if (dayEntries.length === 0) {
          rating = 'no_data'
        } else if (isLimitTarget) {
          // For limit targets: no related activity = good, <30min = neutral, >30min = rough
          if (!hadDistraction || dayTargetMinutes === 0) {
            rating = 'good'
            goodDays++
          } else if (dayTargetMinutes <= 30) {
            rating = 'neutral'
          } else {
            rating = 'rough'
            roughDays++
          }
        } else {
          // For growth targets: compare against daily target
          if (dayTargetMinutes >= dailyTarget) {
            rating = 'good'
            goodDays++
          } else if (dayTargetMinutes >= dailyTarget * 0.5) {
            rating = 'neutral'
          } else if (dayTargetMinutes > 0) {
            rating = 'neutral'
          } else {
            rating = 'rough'
            roughDays++
          }
        }

        days.push({
          date,
          day: getShortDayName(date),
          rating,
          targetMinutes: dayTargetMinutes,
          hadDistraction,
        })
      })

      return {
        targetId: target.id,
        targetLabel: config ? config.label : target.target_type,
        isLimitTarget,
        days,
        goodDays,
        roughDays,
      }
    })

    // Find best days (most productive)
    const dayMinutes = new Map<string, number>()
    Array.from(entriesByDay.entries()).forEach(([date, dayEntries]) => {
      const productiveMinutes = dayEntries
        .filter((e) => e.category && e.category !== 'entertainment')
        .reduce((sum, e) => sum + e.duration_minutes, 0)
      dayMinutes.set(date, productiveMinutes)
    })

    const bestDays = Array.from(dayMinutes.entries())
      .filter(([, minutes]) => minutes > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([date]) => getDayName(date))

    // Calculate time-of-day patterns for best hours
    const hourMap = new Map<number, { minutes: number; categories: Map<TimeCategory, number> }>()
    entries.forEach((entry) => {
      if (entry.start_time) {
        const hour = parseInt(entry.start_time.split(':')[0], 10)
        const hourData = hourMap.get(hour) || { minutes: 0, categories: new Map() }
        hourData.minutes += entry.duration_minutes
        if (entry.category) {
          const catMinutes = hourData.categories.get(entry.category) || 0
          hourData.categories.set(entry.category, catMinutes + entry.duration_minutes)
        }
        hourMap.set(hour, hourData)
      }
    })

    const bestHours = Array.from(hourMap.entries())
      .filter(([, data]) => {
        const deepWork = data.categories.get('deep_work') || 0
        const learning = data.categories.get('learning') || 0
        return deepWork + learning > data.minutes * 0.3 // At least 30% productive
      })
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 2)
      .map(([hour]) => formatHour(hour))

    // Generate insights
    const insights: string[] = []

    if (bestDays.length > 0 && bestHours.length > 0) {
      insights.push(`Best focus: ${bestDays.join(' & ')}, ${bestHours.join('-')}`)
    }

    const topCategory = categoryBreakdown[0]
    if (topCategory) {
      const hours = Math.round((topCategory.minutes / 60) * 10) / 10
      insights.push(`Most time: ${topCategory.label} (${hours}h, ${topCategory.percentage}%)`)
    }

    if (hasPreviousWeekData && previousWeekMinutes !== null) {
      const change = Math.round(((totalMinutes - previousWeekMinutes) / previousWeekMinutes) * 100)
      if (change > 10) {
        insights.push(`Logged ${change}% more time than last week`)
      } else if (change < -10) {
        insights.push(`Logged ${Math.abs(change)}% less time than last week`)
      }
    }

    // Calculate active days (days with at least one entry)
    const activeDays = Array.from(entriesByDay.values()).filter(dayEntries => dayEntries.length > 0).length
    // How many days are we actually evaluating (excludes today for current week)
    const evaluatedDays = entriesByDay.size

    // Calculate Week Score (0-100)
    // Components:
    // - Active days: 0-N days → 0-35 points (scaled to evaluated days)
    // - Target progress: average % across targets → 0-45 points
    // - Consistency: ratio of good days to total active days → 0-20 points
    let weekScore = 0

    // Active days component (35 points max, scaled to evaluated days)
    const activeDaysScore = evaluatedDays > 0 ? Math.round((activeDays / evaluatedDays) * 35) : 0
    weekScore += activeDaysScore

    // Target progress component (45 points max)
    if (targetProgress.length > 0) {
      const avgTargetProgress = targetProgress.reduce((sum, tp) => {
        if (tp.isLimitTarget) {
          // For limit targets, less is better. Score based on staying under limit
          if (tp.targetMinutes && tp.targetMinutes > 0) {
            const ratio = tp.currentMinutes / tp.targetMinutes
            return sum + Math.max(0, Math.min(100, (1 - ratio + 0.5) * 100)) // Under limit = 100%+, at limit = 50%
          }
          return sum + (tp.improvementPercentage !== null ? Math.max(0, 50 + tp.improvementPercentage / 2) : 50)
        }
        return sum + (tp.percentage || 0)
      }, 0) / targetProgress.length
      const targetScore = Math.round((Math.min(avgTargetProgress, 100) / 100) * 45)
      weekScore += targetScore
    } else {
      // No targets set, give partial credit based on activity
      weekScore += evaluatedDays > 0 ? Math.round((activeDays / evaluatedDays) * 20) : 0
    }

    // Consistency component (20 points max)
    if (targetScorecards.length > 0) {
      const totalGoodDays = targetScorecards.reduce((sum, sc) => sum + sc.goodDays, 0)
      const totalPossibleGoodDays = targetScorecards.length * activeDays
      if (totalPossibleGoodDays > 0) {
        const consistencyRatio = totalGoodDays / totalPossibleGoodDays
        weekScore += Math.round(consistencyRatio * 20)
      }
    } else {
      // No scorecards, give partial credit
      weekScore += evaluatedDays > 0 ? Math.round((activeDays / evaluatedDays) * 10) : 0
    }

    // Cap at 100
    weekScore = Math.min(100, weekScore)

    // Generate week score label
    let weekScoreLabel = ''
    if (weekScore >= 85) weekScoreLabel = 'Exceptional week'
    else if (weekScore >= 70) weekScoreLabel = 'Strong week'
    else if (weekScore >= 55) weekScoreLabel = 'Good progress'
    else if (weekScore >= 40) weekScoreLabel = 'Building momentum'
    else if (weekScore >= 25) weekScoreLabel = 'Getting started'
    else weekScoreLabel = 'Room to grow'

    // Generate highlights
    const highlights: WeekHighlight[] = []

    // Highlight: Active days
    if (activeDays >= 6) {
      highlights.push({
        type: 'consistency',
        icon: '🔥',
        text: `${activeDays}/7 days active`,
        subtext: activeDays === 7 ? 'Perfect week!' : 'Nearly perfect',
      })
    }

    // Highlight: Targets hit
    const targetsHit = targetProgress.filter(tp => {
      if (tp.isLimitTarget) {
        return tp.targetMinutes && tp.currentMinutes <= tp.targetMinutes
      }
      return tp.percentage !== null && tp.percentage >= 100
    })
    if (targetsHit.length > 0) {
      highlights.push({
        type: 'target_hit',
        icon: '✓',
        text: `Hit ${targetsHit.length} of ${targetProgress.length} targets`,
        subtext: targetsHit.map(t => t.label).join(', '),
      })
    }

    // Highlight: Week-over-week improvements
    targetProgress.forEach(tp => {
      if (tp.changeMinutes !== null && tp.previousMinutes !== null && tp.previousMinutes > 0) {
        const changePercent = Math.round((tp.changeMinutes / tp.previousMinutes) * 100)

        if (tp.isLimitTarget && changePercent < -20) {
          // Significant reduction in something we want less of
          highlights.push({
            type: 'improvement',
            icon: '⬇️',
            text: `${Math.abs(changePercent)}% less ${tp.label.toLowerCase()}`,
            subtext: 'vs last week',
          })
        } else if (!tp.isLimitTarget && changePercent > 20) {
          // Significant increase in something we want more of
          highlights.push({
            type: 'improvement',
            icon: '⬆️',
            text: `${changePercent}% more ${tp.label.toLowerCase()}`,
            subtext: 'vs last week',
          })
        }
      }
    })

    // Highlight: Best day
    if (bestDays.length > 0) {
      const bestDayDate = Array.from(dayMinutes.entries())
        .filter(([, minutes]) => minutes > 0)
        .sort((a, b) => b[1] - a[1])[0]
      if (bestDayDate) {
        const hours = Math.round((bestDayDate[1] / 60) * 10) / 10
        highlights.push({
          type: 'personal_best',
          icon: '⭐',
          text: `Best day: ${getDayName(bestDayDate[0])}`,
          subtext: `${hours}h of focused time`,
        })
      }
    }

    // Limit to top 4 highlights
    const topHighlights = highlights.slice(0, 4)

    // Generate AI coach summary only if enough data
    let coachSummary: string | null = null

    if (hasEnoughData && entries.length > 0) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const context = `
Weekly Review Data:
- Total logged: ${Math.round((totalMinutes / 60) * 10) / 10} hours (${entryCount} entries)
- Previous week: ${hasPreviousWeekData && previousWeekMinutes ? Math.round((previousWeekMinutes / 60) * 10) / 10 + ' hours' : 'Not enough data'}
- Best days: ${bestDays.join(', ') || 'Not enough data'}
- Best hours: ${bestHours.join(', ') || 'Not enough data'}

Category breakdown:
${categoryBreakdown.map((c) => `- ${c.label}: ${Math.round((c.minutes / 60) * 10) / 10}h (${c.percentage}%)`).join('\n')}

User targets:
${targetProgress
  .map((tp) => {
    const hours = Math.round((tp.currentMinutes / 60) * 10) / 10
    const targetHours = tp.targetMinutes ? Math.round((tp.targetMinutes / 60) * 10) / 10 : null

    if (tp.isLimitTarget) {
      const prevHours = tp.previousMinutes ? Math.round((tp.previousMinutes / 60) * 10) / 10 : null
      const changeStr = tp.changeMinutes !== null
        ? (tp.changeMinutes < 0 ? `↓${Math.abs(Math.round(tp.changeMinutes / 60 * 10) / 10)}h` : `↑${Math.round(tp.changeMinutes / 60 * 10) / 10}h`)
        : 'no comparison'
      return `- ${tp.label}: ${hours}h this week (${changeStr} vs last week) - LIMIT TARGET`
    }

    const progressStr = targetHours ? ` (${tp.percentage}% of ${targetHours}h target)` : ''
    const trendStr = tp.trend ? ` [${tp.trend} vs last week]` : ''
    return `- ${tp.label}: ${hours}h${progressStr}${trendStr}`
  })
  .join('\n')}

Target scorecards (good/rough days):
${targetScorecards.map((sc) => `- ${sc.targetLabel}: ${sc.goodDays} good days, ${sc.roughDays} rough days`).join('\n')}
`

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a supportive personal time coach. Write a brief weekly reflection (3-4 sentences max).

Structure your response in 3 parts:
1. What went well (acknowledge wins, even small ones)
2. What to watch (a pattern or area needing attention, if any)
3. One specific, actionable suggestion for next week

Be warm but direct. Use "you" language. Reference specific data from their week.
Don't use bullet points - write in flowing prose.
Keep it concise - no more than 4 sentences total.
For limit targets like "leisure" or "meetings", celebrate decreases and gently note increases.`,
            },
            {
              role: 'user',
              content: context,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        })

        coachSummary = completion.choices[0]?.message?.content?.trim() || null
      } catch (error) {
        console.error('Failed to generate coach summary:', error)
      }
    }

    const reviewData: WeeklyReviewData = {
      weekStart,
      weekEnd,
      // New hero metrics
      weekScore,
      weekScoreLabel,
      activeDays,
      evaluatedDays,
      highlights: topHighlights,
      // Existing
      totalMinutes,
      entryCount,
      previousWeekMinutes,
      previousWeekEntryCount,
      hasEnoughData,
      hasPreviousWeekData,
      targetProgress,
      targetScorecards,
      categoryBreakdown,
      bestDays,
      bestHours,
      insights,
      coachSummary,
    }

    return NextResponse.json(reviewData)
  } catch (error) {
    console.error('Weekly review error:', error)
    return NextResponse.json({ error: 'Failed to generate weekly review' }, { status: 500 })
  }
}
