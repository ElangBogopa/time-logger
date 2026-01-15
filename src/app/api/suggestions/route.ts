import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { TimeCategory, TimeEntry } from '@/lib/types'

export interface ActivitySuggestion {
  activity: string
  category: TimeCategory | null
  suggestedDuration: number
  startTime: string
  endTime: string
  source: 'pattern' | 'recent'
  confidence: 'high' | 'medium'
}

// Get day of week (0 = Sunday, 6 = Saturday)
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay()
}

// Parse time string to minutes from midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Format minutes to HH:MM
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Check if two time ranges overlap significantly
function hasSignificantOverlap(
  start1: number, end1: number,
  start2: number, end2: number,
  threshold = 0.3
): boolean {
  const overlapStart = Math.max(start1, start2)
  const overlapEnd = Math.min(end1, end2)
  if (overlapStart >= overlapEnd) return false

  const overlapDuration = overlapEnd - overlapStart
  const duration1 = end1 - start1
  return overlapDuration / duration1 >= threshold
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentTime, date } = await request.json()

    if (!currentTime || !date) {
      return NextResponse.json({ error: 'currentTime and date are required' }, { status: 400 })
    }

    const currentMinutes = timeToMinutes(currentTime)
    const currentDayOfWeek = getDayOfWeek(date)

    // Get entries from the last 4 weeks for pattern analysis
    const [year, month, day] = date.split('-').map(Number)
    const fourWeeksAgo = new Date(year, month - 1, day)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const fourWeeksAgoStr = `${fourWeeksAgo.getFullYear()}-${String(fourWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(fourWeeksAgo.getDate()).padStart(2, '0')}`

    const { data: historicalEntries, error: histError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'confirmed')
      .gte('date', fourWeeksAgoStr)
      .lt('date', date)
      .order('date', { ascending: false })

    if (histError) {
      console.error('Error fetching historical entries:', histError)
      return NextResponse.json({ suggestions: [] })
    }

    const entries = (historicalEntries || []) as TimeEntry[]

    // Get today's entries to avoid suggesting duplicates
    const { data: todayEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', date)

    const todayActivities = new Set(
      (todayEntries || []).map((e: TimeEntry) => e.activity.toLowerCase())
    )

    const suggestions: ActivitySuggestion[] = []

    // === PATTERN-BASED SUGGESTIONS ===
    // Find activities that happen at similar time on same day of week
    const patternCandidates = new Map<string, {
      count: number
      totalDuration: number
      category: TimeCategory | null
      avgStartMinutes: number
    }>()

    entries.forEach(entry => {
      if (!entry.start_time) return

      const entryDayOfWeek = getDayOfWeek(entry.date)
      const entryStartMinutes = timeToMinutes(entry.start_time)

      // Check if same day of week and within ±2 hours of current time
      const isSameDayOfWeek = entryDayOfWeek === currentDayOfWeek
      const isNearCurrentTime = Math.abs(entryStartMinutes - currentMinutes) <= 120

      if (isSameDayOfWeek && isNearCurrentTime) {
        const key = entry.activity.toLowerCase()
        const existing = patternCandidates.get(key)

        if (existing) {
          existing.count++
          existing.totalDuration += entry.duration_minutes
          existing.avgStartMinutes = (existing.avgStartMinutes + entryStartMinutes) / 2
        } else {
          patternCandidates.set(key, {
            count: 1,
            totalDuration: entry.duration_minutes,
            category: entry.category,
            avgStartMinutes: entryStartMinutes,
          })
        }
      }
    })

    // Sort by frequency and add top patterns
    const sortedPatterns = Array.from(patternCandidates.entries())
      .filter(([activity]) => !todayActivities.has(activity))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 2)

    sortedPatterns.forEach(([activity, data]) => {
      const avgDuration = Math.round(data.totalDuration / data.count / 15) * 15 // Round to 15 min
      const startMinutes = Math.round(data.avgStartMinutes / 5) * 5 // Round to 5 min
      const endMinutes = startMinutes + avgDuration

      suggestions.push({
        activity: activity.charAt(0).toUpperCase() + activity.slice(1),
        category: data.category,
        suggestedDuration: avgDuration || 60,
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
        source: 'pattern',
        confidence: data.count >= 3 ? 'high' : 'medium',
      })
    })

    // === RECENT ACTIVITY SUGGESTIONS ===
    // Suggest continuation of recent activities from today/yesterday
    const recentDates = [date]
    const yesterday = new Date(date + 'T00:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    recentDates.push(yesterday.toISOString().split('T')[0])

    const recentEntries = entries
      .filter(e => recentDates.includes(e.date) && e.start_time)
      .slice(0, 10)

    // Find most common recent activity not already suggested or logged today
    const suggestedActivities = new Set(suggestions.map(s => s.activity.toLowerCase()))

    const recentCounts = new Map<string, { entry: TimeEntry; count: number }>()
    recentEntries.forEach(entry => {
      const key = entry.activity.toLowerCase()
      if (!todayActivities.has(key) && !suggestedActivities.has(key)) {
        const existing = recentCounts.get(key)
        if (existing) {
          existing.count++
        } else {
          recentCounts.set(key, { entry, count: 1 })
        }
      }
    })

    // Add top recent activity if we have room
    if (suggestions.length < 3) {
      const topRecent = Array.from(recentCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3 - suggestions.length)

      topRecent.forEach(([, data]) => {
        const entry = data.entry
        const duration = entry.duration_minutes || 60
        const endMinutes = currentMinutes
        const startMinutes = endMinutes - duration

        suggestions.push({
          activity: entry.activity,
          category: entry.category,
          suggestedDuration: duration,
          startTime: minutesToTime(Math.max(0, startMinutes)),
          endTime: minutesToTime(endMinutes),
          source: 'recent',
          confidence: 'medium',
        })
      })
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Suggestions error:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
