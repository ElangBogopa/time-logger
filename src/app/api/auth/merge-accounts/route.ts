import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emailUserId, googleUserId, pendingId } = await request.json()

    if (!emailUserId || !googleUserId) {
      return NextResponse.json({ error: 'Missing emailUserId or googleUserId' }, { status: 400 })
    }

    // Verify the current user is the email user (the one initiating the merge)
    if (session.user.id !== emailUserId) {
      return NextResponse.json(
        { error: 'Can only merge from your own account' },
        { status: 403 }
      )
    }

    // Verify email and google users are different
    if (emailUserId === googleUserId) {
      return NextResponse.json(
        { error: 'Cannot merge account with itself' },
        { status: 400 }
      )
    }

    console.log('[Merge] Starting merge: email=', emailUserId, 'google=', googleUserId)

    // Verify both users exist
    const { data: emailUser, error: emailError } = await supabase
      .from('users')
      .select('id, email, auth_provider')
      .eq('id', emailUserId)
      .single()

    const { data: googleUser, error: googleError } = await supabase
      .from('users')
      .select('id, email, auth_provider')
      .eq('id', googleUserId)
      .single()

    if (emailError || !emailUser) {
      console.error('[Merge] Email user not found:', emailError)
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    if (googleError || !googleUser) {
      console.error('[Merge] Google user not found:', googleError)
      return NextResponse.json({ error: 'Google account not found' }, { status: 404 })
    }

    console.log('[Merge] Email user:', emailUser.email, 'Provider:', emailUser.auth_provider)
    console.log('[Merge] Google user:', googleUser.email, 'Provider:', googleUser.auth_provider)

    const errors: string[] = []

    // 1. Move time_entries from email to google (skip duplicates based on date + start_time)
    // First, get all time entries from both users
    const { data: emailEntries } = await supabase
      .from('time_entries')
      .select('id, date, start_time')
      .eq('user_id', emailUserId)

    const { data: googleEntries } = await supabase
      .from('time_entries')
      .select('date, start_time')
      .eq('user_id', googleUserId)

    if (emailEntries && emailEntries.length > 0) {
      // Create a set of existing Google entry keys (date + start_time)
      const googleEntryKeys = new Set(
        (googleEntries || []).map(e => `${e.date}|${e.start_time || ''}`)
      )

      // Find entries to move (not duplicates) and entries to delete (duplicates)
      const entriesToMove: string[] = []
      const entriesToDelete: string[] = []

      for (const entry of emailEntries) {
        const key = `${entry.date}|${entry.start_time || ''}`
        if (googleEntryKeys.has(key)) {
          // Duplicate - delete email's version, keep Google's
          entriesToDelete.push(entry.id)
        } else {
          // Not a duplicate - move to Google account
          entriesToMove.push(entry.id)
        }
      }

      // Delete duplicate entries
      if (entriesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('time_entries')
          .delete()
          .in('id', entriesToDelete)

        if (deleteError) {
          console.error('[Merge] Failed to delete duplicate time_entries:', deleteError)
          errors.push('time_entries_delete')
        } else {
          console.log('[Merge] Deleted duplicate time_entries:', entriesToDelete.length)
        }
      }

      // Move non-duplicate entries
      if (entriesToMove.length > 0) {
        const { error: moveError } = await supabase
          .from('time_entries')
          .update({ user_id: googleUserId })
          .in('id', entriesToMove)

        if (moveError) {
          console.error('[Merge] Failed to move time_entries:', moveError)
          errors.push('time_entries_move')
        } else {
          console.log('[Merge] Moved time_entries:', entriesToMove.length)
        }
      }
    }

    // 2. Move user_intentions from email to google (skip if same intention_type exists)
    const { data: emailIntentions } = await supabase
      .from('user_intentions')
      .select('id, intention_type')
      .eq('user_id', emailUserId)

    const { data: googleIntentions } = await supabase
      .from('user_intentions')
      .select('intention_type')
      .eq('user_id', googleUserId)

    if (emailIntentions && emailIntentions.length > 0) {
      // Create a set of existing Google intention types
      const googleIntentionTypes = new Set(
        (googleIntentions || []).map(i => i.intention_type)
      )

      // Find intentions to move and to delete
      const intentionsToMove: string[] = []
      const intentionsToDelete: string[] = []

      for (const intention of emailIntentions) {
        if (googleIntentionTypes.has(intention.intention_type)) {
          // Duplicate type - delete email's version
          intentionsToDelete.push(intention.id)
        } else {
          // New type - move to Google account
          intentionsToMove.push(intention.id)
        }
      }

      // Delete duplicate intentions
      if (intentionsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_intentions')
          .delete()
          .in('id', intentionsToDelete)

        if (deleteError) {
          console.error('[Merge] Failed to delete duplicate intentions:', deleteError)
          errors.push('intentions_delete')
        } else {
          console.log('[Merge] Deleted duplicate intentions:', intentionsToDelete.length)
        }
      }

      // Move non-duplicate intentions
      if (intentionsToMove.length > 0) {
        const { error: moveError } = await supabase
          .from('user_intentions')
          .update({ user_id: googleUserId })
          .in('id', intentionsToMove)

        if (moveError) {
          console.error('[Merge] Failed to move intentions:', moveError)
          errors.push('intentions_move')
        } else {
          console.log('[Merge] Moved intentions:', intentionsToMove.length)
        }
      }
    }

    // 3. Delete email user's preferences (keep Google's entirely)
    const { error: deletePrefsError } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', emailUserId)

    if (deletePrefsError) {
      console.error('[Merge] Failed to delete email preferences:', deletePrefsError)
      // Not critical, continue
    } else {
      console.log('[Merge] Deleted email user preferences')
    }

    // 4. Delete any calendar_connections for the email user
    const { error: deleteCalendarError } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('user_id', emailUserId)

    if (deleteCalendarError) {
      console.error('[Merge] Failed to delete email calendar_connections:', deleteCalendarError)
      // Not critical, continue
    } else {
      console.log('[Merge] Deleted email calendar connections')
    }

    // 5. Clean up pending connection if provided
    if (pendingId) {
      await supabase
        .from('pending_calendar_connections')
        .delete()
        .eq('id', pendingId)
      console.log('[Merge] Cleaned up pending connection')
    }

    // 6. Delete the email user account
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', emailUserId)

    if (deleteUserError) {
      console.error('[Merge] Failed to delete email user:', deleteUserError)
      return NextResponse.json(
        { error: 'Failed to complete merge. Some data may have been moved.' },
        { status: 500 }
      )
    }

    console.log('[Merge] Successfully merged accounts - email user deleted')

    if (errors.length > 0) {
      return NextResponse.json({
        success: true,
        warning: `Merge completed with some issues: ${errors.join(', ')}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Merge] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong during merge' },
      { status: 500 }
    )
  }
}
