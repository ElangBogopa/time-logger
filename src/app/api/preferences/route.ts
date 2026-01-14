import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DEFAULT_REMINDER_TIMES, UserPreferences } from '@/lib/types'

// GET /api/preferences - Get user preferences
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (user has no preferences yet)
      throw error
    }

    // Return existing preferences or defaults
    if (preferences) {
      return NextResponse.json({ preferences })
    }

    // Return default preferences (not saved yet)
    return NextResponse.json({
      preferences: {
        user_id: session.user.id,
        reminder_enabled: false,
        reminder_times: DEFAULT_REMINDER_TIMES,
      } as Partial<UserPreferences>,
    })
  } catch (error) {
    console.error('Failed to fetch preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

// PUT /api/preferences - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { reminder_enabled, reminder_times } = body

    // Validate reminder_times structure if provided
    if (reminder_times !== undefined) {
      if (!Array.isArray(reminder_times)) {
        return NextResponse.json({ error: 'reminder_times must be an array' }, { status: 400 })
      }

      for (const rt of reminder_times) {
        if (!rt.id || !rt.label || !rt.time || typeof rt.enabled !== 'boolean') {
          return NextResponse.json({ error: 'Invalid reminder_times structure' }, { status: 400 })
        }
        // Validate time format HH:MM
        if (!/^\d{2}:\d{2}$/.test(rt.time)) {
          return NextResponse.json({ error: 'Invalid time format. Use HH:MM' }, { status: 400 })
        }
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (reminder_enabled !== undefined) updateData.reminder_enabled = reminder_enabled
    if (reminder_times !== undefined) updateData.reminder_times = reminder_times

    // Upsert preferences
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: session.user.id,
        ...updateData,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Failed to update preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
