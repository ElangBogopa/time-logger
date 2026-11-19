import { NextRequest, NextResponse } from 'next/server'
import { getAppSession } from '@/lib/session'
import { supabase } from '@/lib/supabase-server'
import OpenAI from 'openai'
import { TimeCategory, CATEGORY_LABELS, shiftDateString, getWeekStartForDate } from '@/lib/types'
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { stableHash } from '@/lib/ai-text-cache'
import { buildReadSystemPrompt, describeRead, WEEK_REVIEW_PARAMS } from '@/lib/prompts'
import { calcBody, calcFocus, calcSocial, heartMinutes } from '@/lib/metrics-calc'
import { windowsForWake } from '@/lib/ideal-day'
import { ringComparisons, weekRead, type ReviewRead, type RingComparisons, type Row } from '@/lib/review-read'
import { logFinding, type LogFinding } from '@/lib/log-findings'

const MIN_ENTRIES_FOR_REVIEW = 7

// Raise this when the read prompt's voice changes, so old lines are not reused.
const COACH_PROMPT_VERSION = 12

/** What the rules read of an entry. */
const ROW_FIELDS = 'date, activity, category, start_time, end_time, duration_minutes'

interface WeeklyReviewRequest {
  weekStart: string // YYYY-MM-DD of the week's Monday
  timezone?: string // IANA timezone (e.g., 'America/New_York')
  // Fingerprint of the coach summary the caller already has. When it matches
  // this week's read the summary is not regenerated.
  knownCoachFingerprint?: string
  /** When this person wakes, as they have stated it: moves their windows. */
  wakeMinutes?: number | null
}

interface CategoryBreakdown {
  category: TimeCategory
  label: string
  minutes: number
  percentage: number
  entryCount: number
}

interface WeeklyReviewData {
  weekStart: string
  weekEnd: string
  /**
   * Body / Mind / Heart averaged over the days of this week that have
   * anything logged. Null when nothing is logged.
   */
  averages: { body: number; focus: number; social: number } | null
  activeDays: number // Days with entries
  evaluatedDays: number // Days included in review (excludes today for current week)
  totalMinutes: number
  entryCount: number
  previousWeekMinutes: number | null
  previousWeekEntryCount: number
  hasEnoughData: boolean // Current week has >= 7 entries
  hasPreviousWeekData: boolean // Previous week has >= 7 entries
  categoryBreakdown: CategoryBreakdown[]
  /** The one read the review leads with, chosen by fixed rules (lib/review-read.ts). */
  read: ReviewRead
  /** Each ring's average against the person's last four weeks. */
  comparisons: RingComparisons
  /** At most one "what your log shows" finding, from the last three months. */
  finding: LogFinding | null
  /** The read in the model's words; the client shows the facts when it is null. */
  coachSummary: string | null
  // Fingerprint of the read behind coachSummary, so the client can tell us
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

export async function POST(request: NextRequest) {
  try {
    const session = await getAppSession()

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

    const {
      weekStart: requestedWeekStart,
      timezone,
      knownCoachFingerprint,
      wakeMinutes: requestedWake,
    }: WeeklyReviewRequest = await request.json()

    // Require timezone from client - no defaults
    if (!timezone) {
      return NextResponse.json(
        { error: 'Timezone parameter is required' },
        { status: 400 }
      )
    }

    // The person's windows: moved to the wake time they have stated, or the
    // reference day. Anything but a whole minute of the day is no wake time.
    const wakeMinutes =
      typeof requestedWake === 'number' && Number.isInteger(requestedWake) && requestedWake >= 1 && requestedWake <= 1439
        ? requestedWake
        : null
    const windows = windowsForWake(wakeMinutes)

    const today = getTodayInTimezone(timezone)
    // Weeks run Monday to Sunday, as they do everywhere else in the app.
    const weekStart = requestedWeekStart || getWeekStartForDate(today, 1)
    const weekEnd = getWeekEnd(weekStart)

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

    // This week's entries, up to its last finished day.
    const { data: currentWeekEntries } = await supabase
      .from('time_entries')
      .select(ROW_FIELDS)
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', weekStart)
      .lte('date', effectiveEndDate)
      .order('date', { ascending: true })

    // One history query: the thirteen weeks before this one. The last seven
    // days are the week before; the last 28 are what "usual" is read from;
    // all of it, with this week, is what the log finding looks across.
    // Newest first, so a long log keeps its most recent weeks.
    const { data: historyEntries } = await supabase
      .from('time_entries')
      .select(ROW_FIELDS)
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', shiftDateString(weekStart, -91))
      .lte('date', shiftDateString(weekStart, -1))
      .order('date', { ascending: false })

    const entries = (currentWeekEntries || []) as Row[]
    const historyAll = (historyEntries || []) as Row[]
    const previousWeekStart = shiftDateString(weekStart, -7)
    const prevEntries = historyAll.filter((e) => e.date >= previousWeekStart)

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
        const category = entry.category as TimeCategory
        const current = categoryMap.get(category) || { minutes: 0, count: 0 }
        categoryMap.set(category, {
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

    // The week's days up to its last finished one, logged or not.
    const rows = entries.filter((e) => e.category)
    const days: { date: string; rows: Row[] }[] = []
    for (let i = 0; i < 7; i++) {
      const date = shiftDateString(weekStart, i)
      if (date > effectiveEndDate) break
      days.push({ date, rows: rows.filter((e) => e.date === date) })
    }
    const evaluatedDays = days.length
    const activeDays = days.filter((d) => d.rows.length > 0).length

    // Each day on the app's one scale, averaged over the days with anything logged.
    const dayScores = days
      .filter((d) => d.rows.length > 0)
      .map((d) => ({ body: calcBody(d.rows), focus: calcFocus(d.rows), social: calcSocial(d.rows) }))
    const average = (pick: (d: (typeof dayScores)[number]) => number) =>
      dayScores.length > 0 ? Math.round(dayScores.reduce((sum, d) => sum + pick(d), 0) / dayScores.length) : 0
    const averages =
      dayScores.length > 0
        ? { body: average((d) => d.body), focus: average((d) => d.focus), social: average((d) => d.social) }
        : null

    // The read, its ring lines and the finding, all by fixed rules.
    const historyRows = historyAll.filter((e) => e.category)
    const history28 = historyRows.filter((e) => e.date >= shiftDateString(weekStart, -28))
    const comparisons = ringComparisons(averages ?? { body: 0, focus: 0, social: 0 }, history28)
    const read = weekRead({
      days,
      history: history28,
      windows,
      isPartialWeek,
      weekHeartMinutes: heartMinutes(rows),
    })
    const findingFrom = shiftDateString(effectiveEndDate, -89)
    const finding = logFinding({
      rows: [...historyRows, ...rows].filter((e) => e.date >= findingFrom && e.date <= effectiveEndDate),
      windows,
    })

    // The read in words. The model is given the read's facts and nothing
    // else, so hashing them answers the only question that matters: would
    // it be asked the same thing again? If the caller already holds the
    // answer it says so with knownCoachFingerprint, and the call is skipped.
    let coachSummary: string | null = null
    let coachFingerprint: string | null = null
    let coachSummaryUnchanged = false

    if (hasEnoughData && entries.length > 0) {
      coachFingerprint = stableHash(`${COACH_PROMPT_VERSION}\n${read.rule}\n${read.facts.join('\n')}`)
      coachSummaryUnchanged = knownCoachFingerprint === coachFingerprint

      if (!coachSummaryUnchanged) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const completion = await openai.chat.completions.create({
            ...WEEK_REVIEW_PARAMS,
            messages: [
              { role: 'system', content: buildReadSystemPrompt('week', read.kind) },
              { role: 'user', content: describeRead(read) },
            ],
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
      averages,
      activeDays,
      evaluatedDays,
      totalMinutes,
      entryCount,
      previousWeekMinutes,
      previousWeekEntryCount,
      hasEnoughData,
      hasPreviousWeekData,
      categoryBreakdown,
      read,
      comparisons,
      finding,
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
