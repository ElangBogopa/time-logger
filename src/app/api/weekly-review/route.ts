import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  UserIntention,
  INTENTION_LABELS,
  INTENTION_CATEGORY_MAP,
  INTENTION_CONFIGS,
  calculateIntentionProgress,
  getIntentionFeedback,
} from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

const MIN_ENTRIES_FOR_REVIEW = 7

interface WeeklyReviewRequest {
  weekStart: string // YYYY-MM-DD of the Sunday
  timezone?: string // IANA timezone (e.g., 'America/New_York')
}

interface IntentionProgress {
  intention: UserIntention
  label: string
  currentMinutes: number
  targetMinutes: number | null
  percentage: number | null
  trend: 'up' | 'down' | 'same' | null
  previousMinutes: number | null
  isReductionGoal: boolean // For goals like "less_distraction"
  changeMinutes: number | null // Difference from last week
  improvementPercentage: number | null // For reduction goals
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

interface IntentionDayScore {
  date: string
  day: string // 'Mon', 'Tue', etc.
  rating: DayRating
  intentionMinutes: number
  hadDistraction: boolean // For less_distraction goals
}

interface IntentionScorecard {
  intentionId: string
  intentionLabel: string
  isReductionGoal: boolean
  days: IntentionDayScore[]
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
  activeDays: number // Days with entries out of 7
  highlights: WeekHighlight[]
  // Existing
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean // Current week has >= 7 entries
  hasPreviousWeekData: boolean // Previous week has >= 7 entries
  intentionProgress: IntentionProgress[]
  intentionScorecards: IntentionScorecard[]
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

    // Use user's timezone or fall back to UTC
    const userTimezone = timezone || 'UTC'
    const today = getTodayInTimezone(userTimezone)
    const weekStart = requestedWeekStart || getWeekStart(today)
    const weekEnd = getWeekEnd(weekStart)
    const previousWeekStart = getPreviousWeekStart(weekStart)
    const previousWeekEnd = getWeekEnd(previousWeekStart)

    // Fetch current week entries
    const { data: currentWeekEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date', { ascending: true })

    // Fetch previous week entries
    const { data: previousWeekEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', previousWeekStart)
      .lte('date', previousWeekEnd)

    // Fetch user intentions
    const { data: intentions } = await supabase
      .from('user_intentions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .order('priority', { ascending: true })

    const entries = (currentWeekEntries || []) as TimeEntry[]
    const prevEntries = (previousWeekEntries || []) as TimeEntry[]
    const userIntentions = (intentions || []) as UserIntention[]

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
    const entriesByDay = new Map<string, TimeEntry[]>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + 'T00:00:00')
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      entriesByDay.set(dateStr, [])
    }
    entries.forEach((entry) => {
      const dayEntries = entriesByDay.get(entry.date)
      if (dayEntries) {
        dayEntries.push(entry)
      }
    })

    // Calculate intention progress with improved reduction goal handling
    const intentionProgress: IntentionProgress[] = userIntentions.map((intention) => {
      const relatedCategories = INTENTION_CATEGORY_MAP[intention.intention_type]
      const config = INTENTION_CONFIGS[intention.intention_type]
      const isReductionGoal = config.direction === 'minimize'
      let currentMinutes = 0
      let previousMinutes = 0

      if (isReductionGoal) {
        currentMinutes = categoryMap.get('distraction')?.minutes || 0
        previousMinutes = prevCategoryMap.get('distraction') || 0
      } else {
        relatedCategories.forEach((cat) => {
          currentMinutes += categoryMap.get(cat)?.minutes || 0
          previousMinutes += prevCategoryMap.get(cat) || 0
        })
      }

      // Use saved target or fall back to research-based default
      const targetMinutes = intention.weekly_target_minutes || config.defaultTargetMinutes

      // For reduction goals, percentage shows improvement from previous week
      // For growth goals, percentage shows progress toward target
      let percentage: number | null = null
      let improvementPercentage: number | null = null

      if (isReductionGoal && hasPreviousWeekData && previousMinutes > 0) {
        // Improvement = how much we reduced (positive = good)
        improvementPercentage = Math.round(((previousMinutes - currentMinutes) / previousMinutes) * 100)
        percentage = improvementPercentage
      } else if (!isReductionGoal && targetMinutes) {
        percentage = calculateIntentionProgress(currentMinutes, targetMinutes, config.direction)
      }

      // Get research-based feedback
      const feedback = getIntentionFeedback(currentMinutes, targetMinutes, config)

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
        intention,
        label:
          intention.intention_type === 'custom'
            ? intention.custom_text || 'Custom goal'
            : INTENTION_LABELS[intention.intention_type],
        currentMinutes,
        targetMinutes,
        percentage,
        trend,
        previousMinutes: hasPreviousWeekData ? previousMinutes : null,
        isReductionGoal,
        changeMinutes: hasPreviousWeekData ? changeMinutes : null,
        improvementPercentage,
        // Add research-based feedback
        feedbackMessage: feedback.message,
        feedbackTone: feedback.tone,
        researchNote: intention.intention_type !== 'custom' ? config.researchNote : null,
        optimalRangeMin: config.optimalRangeMin,
        optimalRangeMax: config.optimalRangeMax,
      }
    })

    // Build intention scorecards
    const intentionScorecards: IntentionScorecard[] = userIntentions.map((intention) => {
      const relatedCategories = INTENTION_CATEGORY_MAP[intention.intention_type]
      const config = INTENTION_CONFIGS[intention.intention_type]
      const isReductionGoal = config.direction === 'minimize'
      const targetMinutes = intention.weekly_target_minutes || config.defaultTargetMinutes
      const dailyTarget = targetMinutes / 7

      const days: IntentionDayScore[] = []
      let goodDays = 0
      let roughDays = 0

      Array.from(entriesByDay.entries()).forEach(([date, dayEntries]) => {
        let intentionMinutes = 0
        let hadDistraction = false

        dayEntries.forEach((entry) => {
          if (isReductionGoal) {
            if (entry.category === 'distraction') {
              intentionMinutes += entry.duration_minutes
              hadDistraction = true
            }
          } else {
            if (entry.category && relatedCategories.includes(entry.category)) {
              intentionMinutes += entry.duration_minutes
            }
          }
        })

        let rating: DayRating = 'no_data'

        if (dayEntries.length === 0) {
          rating = 'no_data'
        } else if (isReductionGoal) {
          // For reduction goals: no distraction = good, <30min = neutral, >30min = rough
          if (!hadDistraction || intentionMinutes === 0) {
            rating = 'good'
            goodDays++
          } else if (intentionMinutes <= 30) {
            rating = 'neutral'
          } else {
            rating = 'rough'
            roughDays++
          }
        } else {
          // For growth goals: compare against daily target from research-based config
          if (intentionMinutes >= dailyTarget) {
            rating = 'good'
            goodDays++
          } else if (intentionMinutes >= dailyTarget * 0.5) {
            rating = 'neutral'
          } else if (intentionMinutes > 0) {
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
          intentionMinutes,
          hadDistraction,
        })
      })

      return {
        intentionId: intention.id,
        intentionLabel:
          intention.intention_type === 'custom'
            ? intention.custom_text || 'Custom goal'
            : INTENTION_LABELS[intention.intention_type],
        isReductionGoal,
        days,
        goodDays,
        roughDays,
      }
    })

    // Find best days (most productive)
    const dayMinutes = new Map<string, number>()
    Array.from(entriesByDay.entries()).forEach(([date, dayEntries]) => {
      const productiveMinutes = dayEntries
        .filter((e) => e.category && e.category !== 'distraction')
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

    // Calculate Week Score (0-100)
    // Components:
    // - Active days: 0-7 days → 0-35 points (5 points per day)
    // - Intention progress: average % across intentions → 0-45 points
    // - Consistency: ratio of good days to total active days → 0-20 points
    let weekScore = 0

    // Active days component (35 points max)
    const activeDaysScore = Math.round((activeDays / 7) * 35)
    weekScore += activeDaysScore

    // Intention progress component (45 points max)
    if (intentionProgress.length > 0) {
      const avgIntentionProgress = intentionProgress.reduce((sum, ip) => {
        if (ip.isReductionGoal) {
          // For reduction goals, less is better. Score based on staying under limit
          if (ip.targetMinutes && ip.targetMinutes > 0) {
            const ratio = ip.currentMinutes / ip.targetMinutes
            return sum + Math.max(0, Math.min(100, (1 - ratio + 0.5) * 100)) // Under limit = 100%+, at limit = 50%
          }
          return sum + (ip.improvementPercentage !== null ? Math.max(0, 50 + ip.improvementPercentage / 2) : 50)
        }
        return sum + (ip.percentage || 0)
      }, 0) / intentionProgress.length
      const intentionScore = Math.round((Math.min(avgIntentionProgress, 100) / 100) * 45)
      weekScore += intentionScore
    } else {
      // No intentions set, give partial credit based on activity
      weekScore += Math.round((activeDays / 7) * 20)
    }

    // Consistency component (20 points max)
    if (intentionScorecards.length > 0) {
      const totalGoodDays = intentionScorecards.reduce((sum, sc) => sum + sc.goodDays, 0)
      const totalPossibleGoodDays = intentionScorecards.length * activeDays
      if (totalPossibleGoodDays > 0) {
        const consistencyRatio = totalGoodDays / totalPossibleGoodDays
        weekScore += Math.round(consistencyRatio * 20)
      }
    } else {
      // No scorecards, give partial credit
      weekScore += Math.round((activeDays / 7) * 10)
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

    // Highlight: Intention targets hit
    const targetsHit = intentionProgress.filter(ip => {
      if (ip.isReductionGoal) {
        return ip.targetMinutes && ip.currentMinutes <= ip.targetMinutes
      }
      return ip.percentage !== null && ip.percentage >= 100
    })
    if (targetsHit.length > 0) {
      highlights.push({
        type: 'target_hit',
        icon: '✓',
        text: `Hit ${targetsHit.length} of ${intentionProgress.length} targets`,
        subtext: targetsHit.map(t => t.label).join(', '),
      })
    }

    // Highlight: Week-over-week improvements
    intentionProgress.forEach(ip => {
      if (ip.changeMinutes !== null && ip.previousMinutes !== null && ip.previousMinutes > 0) {
        const changePercent = Math.round((ip.changeMinutes / ip.previousMinutes) * 100)

        if (ip.isReductionGoal && changePercent < -20) {
          // Significant reduction in something we want less of
          highlights.push({
            type: 'improvement',
            icon: '⬇️',
            text: `${Math.abs(changePercent)}% less ${ip.label.toLowerCase()}`,
            subtext: 'vs last week',
          })
        } else if (!ip.isReductionGoal && changePercent > 20) {
          // Significant increase in something we want more of
          highlights.push({
            type: 'improvement',
            icon: '⬆️',
            text: `${changePercent}% more ${ip.label.toLowerCase()}`,
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

User intentions:
${intentionProgress
  .map((ip) => {
    const hours = Math.round((ip.currentMinutes / 60) * 10) / 10
    const targetHours = ip.targetMinutes ? Math.round((ip.targetMinutes / 60) * 10) / 10 : null

    if (ip.isReductionGoal) {
      const prevHours = ip.previousMinutes ? Math.round((ip.previousMinutes / 60) * 10) / 10 : null
      const changeStr = ip.changeMinutes !== null
        ? (ip.changeMinutes < 0 ? `↓${Math.abs(Math.round(ip.changeMinutes / 60 * 10) / 10)}h` : `↑${Math.round(ip.changeMinutes / 60 * 10) / 10}h`)
        : 'no comparison'
      return `- ${ip.label}: ${hours}h this week (${changeStr} vs last week) - WANT LESS`
    }

    const progressStr = targetHours ? ` (${ip.percentage}% of ${targetHours}h target)` : ''
    const trendStr = ip.trend ? ` [${ip.trend} vs last week]` : ''
    return `- ${ip.label}: ${hours}h${progressStr}${trendStr}`
  })
  .join('\n')}

Intention scorecards (good/rough days):
${intentionScorecards.map((sc) => `- ${sc.intentionLabel}: ${sc.goodDays} good days, ${sc.roughDays} rough days`).join('\n')}
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
For reduction goals like "less distraction", celebrate decreases and gently note increases.`,
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
      highlights: topHighlights,
      // Existing
      totalMinutes,
      entryCount,
      previousWeekMinutes,
      previousWeekEntryCount,
      hasEnoughData,
      hasPreviousWeekData,
      intentionProgress,
      intentionScorecards,
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
