import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
} from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

const MIN_ENTRIES_FOR_REVIEW = 7

interface WeeklyReviewRequest {
  weekStart: string // YYYY-MM-DD of the Sunday
  timezone?: string // IANA timezone (e.g., 'America/New_York')
}

interface CategoryBreakdown {
  category: TimeCategory
  label: string
  minutes: number
  percentage: number
  entryCount: number
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

    const entries = (currentWeekEntries || []) as TimeEntry[]
    const prevEntries = (previousWeekEntries || []) as TimeEntry[]

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

    // Calculate evaluatedDays
    const evaluatedDays = entriesByDay.size

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
    // evaluatedDays already calculated above (before scorecards)

    // Calculate Week Score (0-100)
    // Based on active days and activity volume
    let weekScore = 0

    // Active days component (50 points max, scaled to evaluated days)
    const activeDaysScore = evaluatedDays > 0 ? Math.round((activeDays / evaluatedDays) * 50) : 0
    weekScore += activeDaysScore

    // Activity volume component (50 points max, based on entries per active day)
    if (activeDays > 0) {
      const avgEntriesPerDay = entryCount / activeDays
      // Scale: 3 entries/day = full marks
      const volumeScore = Math.round(Math.min(avgEntriesPerDay / 3, 1) * 50)
      weekScore += volumeScore
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
