import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'

/**
 * One-time backfill: generates and saves day reviews for all locked dates
 * that have entries but no finalized review yet.
 * 
 * Call: POST /api/day-review/backfill
 */

function getDateDaysAgo(baseDate: string, days: number): string {
  const [y, m, d] = baseDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const today = getUserToday()
    const yesterday = getDateDaysAgo(today, 1)

    // Step 1: Get all unique dates with entries (locked dates only = before yesterday)
    const { data: dateRows, error: dateError } = await supabase
      .from('time_entries')
      .select('date')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .lt('date', yesterday) // strictly before yesterday = locked
      .order('date', { ascending: true })

    if (dateError) {
      return NextResponse.json({ error: 'Failed to fetch dates' }, { status: 500 })
    }

    // Deduplicate dates
    const allDates = [...new Set((dateRows || []).map(r => r.date))]

    // Step 2: Check which dates already have finalized reviews
    const { data: existingReviews } = await supabase
      .from('day_reviews')
      .select('date')
      .eq('user_id', userId)
      .eq('finalized', true)

    const finalizedDates = new Set((existingReviews || []).map(r => r.date))
    const datesToBackfill = allDates.filter(d => !finalizedDates.has(d))

    if (datesToBackfill.length === 0) {
      return NextResponse.json({ message: 'All dates already backfilled', total: 0 })
    }

    // Step 3: For each date, call the day-summary API internally and save
    const baseUrl = request.nextUrl.origin
    const results: { date: string; status: string }[] = []

    for (const date of datesToBackfill) {
      try {
        // Fetch day summary for this date
        const summaryRes = await fetch(`${baseUrl}/api/day-summary?date=${date}`, {
          headers: {
            cookie: request.headers.get('cookie') || '',
          },
        })

        if (!summaryRes.ok) {
          results.push({ date, status: 'summary_failed' })
          continue
        }

        const summary = await summaryRes.json()

        // Skip dates with no logged time
        if (!summary.totalMinutesLogged || summary.totalMinutesLogged === 0) {
          results.push({ date, status: 'skipped_no_entries' })
          continue
        }

        // Generate AI commentary
        let commentary: string | null = null
        try {
          const commentaryRes = await fetch(`${baseUrl}/api/day-commentary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              score: summary.score,
              totalMinutesLogged: summary.totalMinutesLogged,
              wins: summary.wins,
              targetProgress: summary.targetProgress,
              mood: summary.todayMood?.mood || null,
              longestFocusSession: summary.longestFocusSession,
            }),
          })
          if (commentaryRes.ok) {
            const commentaryData = await commentaryRes.json()
            commentary = commentaryData.commentary || null
          }
        } catch {
          // Commentary is optional — save without it
        }

        // Save to day_reviews
        const { error: saveError } = await supabase
          .from('day_reviews')
          .upsert(
            {
              user_id: userId,
              date,
              score: summary.score,
              score_color: summary.scoreColor,
              sessions_logged: summary.sessionsLogged || 0,
              total_sessions: summary.totalSessions || 3,
              total_minutes_logged: summary.totalMinutesLogged || 0,
              commentary,
              wins: summary.wins || [],
              target_progress: summary.targetProgress || [],
              category_breakdown: summary.categoryBreakdown || [],
              aggregated_breakdown: summary.aggregatedBreakdown || [],
              timeline: summary.timeline || [],
              longest_focus_session: summary.longestFocusSession || null,
              mood: summary.todayMood || null,
              finalized: true,
              finalized_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,date' }
          )

        if (saveError) {
          results.push({ date, status: `save_failed: ${saveError.message}` })
        } else {
          results.push({ date, status: 'finalized' })
        }
      } catch (err) {
        results.push({ date, status: `error: ${err instanceof Error ? err.message : 'unknown'}` })
      }
    }

    const finalized = results.filter(r => r.status === 'finalized').length
    const skipped = results.filter(r => r.status === 'skipped_no_entries').length
    const failed = results.filter(r => !['finalized', 'skipped_no_entries'].includes(r.status)).length

    return NextResponse.json({
      message: `Backfill complete: ${finalized} finalized, ${skipped} skipped, ${failed} failed`,
      total: datesToBackfill.length,
      finalized,
      skipped,
      failed,
      results,
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 })
  }
}
