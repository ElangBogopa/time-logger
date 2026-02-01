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

    const { emailUserId, googleUserId } = await request.json()

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

    if (emailUserId === googleUserId) {
      return NextResponse.json(
        { error: 'Cannot merge account with itself' },
        { status: 400 }
      )
    }

    console.log('[Merge] Starting atomic merge: email=', emailUserId, 'google=', googleUserId)

    // Call the Postgres function — runs as a single transaction
    const { data, error } = await supabase.rpc('merge_accounts', {
      p_email_user_id: emailUserId,
      p_google_user_id: googleUserId,
    })

    if (error) {
      console.error('[Merge] Transaction failed (rolled back):', error)
      return NextResponse.json(
        { error: 'Merge failed — no data was changed. Please try again.' },
        { status: 500 }
      )
    }

    console.log('[Merge] Transaction completed successfully:', data)

    return NextResponse.json({
      success: true,
      details: data,
    })
  } catch (error) {
    console.error('[Merge] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong during merge' },
      { status: 500 }
    )
  }
}
