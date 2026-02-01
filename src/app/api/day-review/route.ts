import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { getUserToday } from '@/lib/types'

/**
 * Day Review Persistence API
 * 
 * Logic:
 * - Today & yesterday: always return live data (editable window)
 * - 2+ days ago: check for saved review in day_reviews table
 *   - If saved & finalized → return it
 *   - If not saved → generate live, finalize & save, then return
 *   - If saved but not finalized → re-generate, update & finalize
 */

function getDateDaysAgo(baseDate: string, days: number): string {
  const [y, m, d] = baseDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

function isWithinEditWindow(dateStr: string, today: string): boolean {
  const yesterday = getDateDaysAgo(today, 1)
  return dateStr === today || dateStr === yesterday
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const dateParam = request.nextUrl.searchParams.get('date')
    const today = dateParam || getUserToday()
    const editable = isWithinEditWindow(dateParam, today)

    // If within edit window, return live data (don't save yet)
    if (editable) {
      return NextResponse.json({ source: 'live', editable: true })
    }

    // Date is locked (2+ days ago) — check for saved finalized review
    const { data: existingReview } = await supabase
      .from('day_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateParam)
      .single()

    if (existingReview?.finalized) {
      // Return saved finalized review
      return NextResponse.json({
        source: 'saved',
        editable: false,
        review: {
          score: existingReview.score,
          scoreColor: existingReview.score_color,
          sessionsLogged: existingReview.sessions_logged,
          totalSessions: existingReview.total_sessions,
          totalMinutesLogged: existingReview.total_minutes_logged,
          hasEveningPassed: true,
          date: existingReview.date,
          commentary: existingReview.commentary,
          wins: existingReview.wins,
          targetProgress: existingReview.target_progress,
          categoryBreakdown: existingReview.category_breakdown,
          aggregatedBreakdown: existingReview.aggregated_breakdown,
          timeline: existingReview.timeline,
          longestFocusSession: existingReview.longest_focus_session,
          todayMood: existingReview.mood,
          finalizedAt: existingReview.finalized_at,
        },
      })
    }

    // Not finalized yet — signal to the client to generate + save
    return NextResponse.json({
      source: 'needs_finalization',
      editable: false,
      existingId: existingReview?.id || null,
    })
  } catch (error) {
    console.error('Day review API error:', error)
    return NextResponse.json({ error: 'Failed to fetch day review' }, { status: 500 })
  }
}

/**
 * POST: Save/finalize a day review
 * Called by the client after generating the summary + commentary for a locked date
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const {
      date,
      score,
      scoreColor,
      sessionsLogged,
      totalSessions,
      totalMinutesLogged,
      commentary,
      wins,
      targetProgress,
      categoryBreakdown,
      aggregatedBreakdown,
      timeline,
      longestFocusSession,
      mood,
    } = body

    if (!date || score == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert the review
    const { data, error } = await supabase
      .from('day_reviews')
      .upsert(
        {
          user_id: userId,
          date,
          score,
          score_color: scoreColor,
          sessions_logged: sessionsLogged || 0,
          total_sessions: totalSessions || 3,
          total_minutes_logged: totalMinutesLogged || 0,
          commentary: commentary || null,
          wins: wins || [],
          target_progress: targetProgress || [],
          category_breakdown: categoryBreakdown || [],
          aggregated_breakdown: aggregatedBreakdown || [],
          timeline: timeline || [],
          longest_focus_session: longestFocusSession || null,
          mood: mood || null,
          finalized: true,
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()

    if (error) {
      console.error('Failed to save day review:', error)
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
    }

    return NextResponse.json({ success: true, review: data })
  } catch (error) {
    console.error('Day review save error:', error)
    return NextResponse.json({ error: 'Failed to save day review' }, { status: 500 })
  }
}
