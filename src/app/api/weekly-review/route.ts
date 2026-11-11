import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  shiftDateString,
  getWeekStartForDate,
} from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { stableHash } from '@/lib/ai-text-cache'
import { calcBody, calcFocus, calcSocial, METRIC_THRESHOLDS, type EntryRow } from '@/lib/metrics-calc'

const MIN_ENTRIES_FOR_REVIEW = 7

interface WeeklyReviewRequest {
  weekStart: string // YYYY-MM-DD of the week's Monday
  timezone?: string // IANA timezone (e.g., 'America/New_York')
  // Fingerprint of the coach summary the caller already has. When it matches
  // this week's prompt inputs the summary is not regenerated.
  knownCoachFingerprint?: string
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
  text: string
  subtext?: string
}

interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  /**
   * Body / Mind / Heart averaged over the days of this week that have
   * anything logged — the same numbers the coach summary is written from.
   * Null when nothing is logged.
   */
  averages: { body: number; focus: number; social: number } | null
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
  // Fingerprint of the inputs behind coachSummary, so the client can tell us
  // next time whether the one it holds is still current.
  coachFingerprint: string | null
  // True when the caller's fingerprint matched and no summary was generated.
  coachSummaryUnchanged: boolean
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

// Get the last day of a given week
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

    // Rate limit by user ID (authenticated) with IP fallback
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const rateLimitKey = `weekly-review:${session.user.id || ip}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.ai)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const { weekStart: requestedWeekStart, timezone, knownCoachFingerprint }: WeeklyReviewRequest =
      await request.json()

    // Require timezone from client - no defaults
    if (!timezone) {
      return NextResponse.json(
        { error: 'Timezone parameter is required' },
        { status: 400 }
      )
    }

    const today = getTodayInTimezone(timezone)
    // Weeks run Monday to Sunday, as they do everywhere else in the app.
    const weekStart = requestedWeekStart || getWeekStartForDate(today, 1)
    const weekEnd = getWeekEnd(weekStart)
    const previousWeekStart = getPreviousWeekStart(weekStart)
    const previousWeekEnd = getWeekEnd(previousWeekStart)

    // For the week in progress, leave today out: the day has not ended.
    //
    // "In progress" means today falls inside the requested week. This used
    // to compare the requested week's start with a Sunday computed here,
    // while the client asks for weeks that start on Monday — so the two
    // never matched, the week in progress was always treated as a finished
    // one, and three days were set against last week's seven.
    const isCurrentWeek = today >= weekStart && today <= weekEnd
    let effectiveEndDate = weekEnd
    if (isCurrentWeek) {
      const yesterday = shiftDateString(today, -1)
      // On the week's first day there is no yesterday inside it: show today.
      effectiveEndDate = yesterday >= weekStart ? yesterday : today
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

    // Like for like. A week in progress is compared with the same days of
    // the week before: on a Wednesday this used to set three days against
    // seven, report "49% less time logged", and hand the model a drop to
    // explain — which it did, by praising the user for logging less.
    const daysSoFar = Math.round(
      (new Date(effectiveEndDate + 'T12:00:00').getTime() - new Date(weekStart + 'T12:00:00').getTime()) /
        86_400_000
    ) + 1
    const isPartialWeek = daysSoFar < 7
    const prevCompareEnd = shiftDateString(previousWeekStart, daysSoFar - 1)
    const prevComparable = isPartialWeek ? prevEntries.filter((e) => e.date <= prevCompareEnd) : prevEntries

    // Calculate totals
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
    const previousWeekMinutes = hasPreviousWeekData && prevComparable.length > 0
      ? prevComparable.reduce((sum, e) => sum + e.duration_minutes, 0)
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
    prevComparable.forEach((entry) => {
      if (entry.category) {
        const current = prevCategoryMap.get(entry.category) || 0
        prevCategoryMap.set(entry.category, current + entry.duration_minutes)
      }
    })

    // Calculate entries by day for scorecard
    // Only include days up to effectiveEndDate (excludes today for current week)
    const entriesByDay = new Map<string, TimeEntry[]>()
    for (let i = 0; i < 7; i++) {
      const dateStr = shiftDateString(weekStart, i)
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

    // The days with the most focused work. This counted everything except
    // entertainment, so a night's sleep was seven hours of "focus" and the
    // best day was whichever one had the most written down.
    const FOCUS_CATEGORIES: TimeCategory[] = ['deep_work', 'learning', 'creating']
    const dayMinutes = new Map<string, number>()
    Array.from(entriesByDay.entries()).forEach(([date, dayEntries]) => {
      const focusMinutes = dayEntries
        .filter((e) => e.category && FOCUS_CATEGORIES.includes(e.category))
        .reduce((sum, e) => sum + e.duration_minutes, 0)
      dayMinutes.set(date, focusMinutes)
    })

    // Each day on the app's one scale.
    const dayScores = Array.from(entriesByDay.entries())
      .filter(([, dayEntries]) => dayEntries.length > 0)
      .map(([date, dayEntries]) => {
        const rows = dayEntries.filter((e) => e.category) as unknown as EntryRow[]
        const body = calcBody(rows)
        const mind = calcFocus(rows)
        const heart = calcSocial(rows)
        const onTarget = [body, mind, heart].filter((v) => v >= METRIC_THRESHOLDS.green).length
        return { date, body, mind, heart, onTarget }
      })
    const average = (pick: (d: (typeof dayScores)[number]) => number) =>
      dayScores.length > 0 ? Math.round(dayScores.reduce((sum, d) => sum + pick(d), 0) / dayScores.length) : 0

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
      // The hours are the two busiest, not the ends of a range: joined with
      // a dash, "9 AM" and "3 PM" read as nine to three.
      insights.push(`Best focus: ${bestDays.join(' & ')}, around ${bestHours.join(' and ')}`)
    }

    // Sleep wins this every week for anyone who logs it, which is not news.
    const topCategory = categoryBreakdown.find((c) => c.category !== 'sleep')
    if (topCategory) {
      const hours = Math.round((topCategory.minutes / 60) * 10) / 10
      insights.push(`Most waking time: ${topCategory.label} (${hours}h)`)
    }

    if (hasPreviousWeekData && previousWeekMinutes !== null) {
      const change = Math.round(((totalMinutes - previousWeekMinutes) / previousWeekMinutes) * 100)
      const versus = isPartialWeek ? 'the same days last week' : 'last week'
      if (change > 10) {
        insights.push(`Logged ${change}% more time than ${versus}`)
      } else if (change < -10) {
        insights.push(`Logged ${Math.abs(change)}% less time than ${versus}`)
      }
    }

    // Calculate active days (days with at least one entry)
    const activeDays = Array.from(entriesByDay.values()).filter(dayEntries => dayEntries.length > 0).length
    // evaluatedDays already calculated above (before scorecards)

    // There was a Week Score here — 50 points for active days, 50 for
    // averaging three entries a day — and the label under the rings came
    // from it: "Exceptional week" over Body 63, Mind 51, Heart 47. It was
    // the last of the showing-up scores. The label is now read off the
    // rings themselves, by the client that draws them.

    const highlights: WeekHighlight[] = []

    // Best day: the one that put most of the three on target, then the
    // highest scores. It was the day with the most minutes logged.
    const bestDay = [...dayScores].sort(
      (a, b) => b.onTarget - a.onTarget || b.body + b.mind + b.heart - (a.body + a.mind + a.heart)
    )[0]
    if (bestDay) {
      highlights.push({
        type: 'personal_best',
        text: `Best day: ${getDayName(bestDay.date)}`,
        subtext: `Body ${bestDay.body} · Mind ${bestDay.mind} · Heart ${bestDay.heart}`,
      })
    }

    // Limit to top 4 highlights
    const topHighlights = highlights.slice(0, 4)

    // Generate AI coach summary only if enough data.
    //
    // The context below is the whole prompt input, so hashing it answers the
    // only question that matters: would the model be asked the same thing
    // again? If the caller already holds the answer to this exact question it
    // says so with knownCoachFingerprint, and we skip the call — this used to
    // regenerate on every single view of the weekly tab.
    let coachSummary: string | null = null
    let coachFingerprint: string | null = null
    let coachSummaryUnchanged = false

    if (hasEnoughData && entries.length > 0) {
      const hoursOf = (minutes: number) => Math.round((minutes / 60) * 10) / 10
      const context = `
Weekly Review Data:
- Days covered: ${isPartialWeek ? `${daysSoFar} of 7 — the week is still in progress` : 'all 7'}
- Days with anything logged: ${dayScores.length}
- Average Body: ${average((d) => d.body)}/100
- Average Mind: ${average((d) => d.mind)}/100
- Average Heart: ${average((d) => d.heart)}/100
- Best focus days: ${bestDays.join(', ') || 'Not enough data'}
- Best focus hours: ${bestHours.join(', ') || 'Not enough data'}

Hours by category${isPartialWeek ? ' so far' : ''}:
${categoryBreakdown.map((c) => `- ${c.label}: ${hoursOf(c.minutes)}h`).join('\n')}

`

      coachFingerprint = stableHash(context)
      coachSummaryUnchanged = knownCoachFingerprint === coachFingerprint

      if (!coachSummaryUnchanged) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a supportive personal time coach. Write a brief weekly reflection (3-4 sentences max).

The week is scored on Body, Mind and Heart, each out of 100. 80 means the daily target was met on average; 100 is not reachable; a low score is information, not a failing.

Structure your response in 3 parts:
1. What went well (something specific from the data)
2. What to watch (a pattern or area needing attention, only if the data shows one)
3. One specific, actionable suggestion for next week

Be warm but direct. Use "you" language. Reference specific data from their week.
Don't use bullet points - write in flowing prose.
Keep it concise - no more than 4 sentences total.
The hours logged only say how much of the week was written down. Never praise or criticise the total, and never treat logging fewer hours as an achievement.
Sleep is the largest category for anyone who logs it; do not present that as a finding.
If the week is still in progress, say "so far" and do not compare it with a full week.`,
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
    }

    const reviewData: WeeklyReviewData = {
      weekStart,
      weekEnd,
      averages:
        dayScores.length > 0
          ? { body: average((d) => d.body), focus: average((d) => d.mind), social: average((d) => d.heart) }
          : null,
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
      coachFingerprint,
      coachSummaryUnchanged,
    }

    return NextResponse.json(reviewData)
  } catch (error) {
    console.error('Weekly review error:', error)
    return NextResponse.json({ error: 'Failed to generate weekly review' }, { status: 500 })
  }
}
