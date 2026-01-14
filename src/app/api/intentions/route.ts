import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { IntentionType, UserIntention } from '@/lib/types'

// GET /api/intentions - Fetch user's intentions
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { data: intentions, error } = await supabase
      .from('user_intentions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Error fetching intentions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch intentions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ intentions: intentions || [] })
  } catch (error) {
    console.error('Intentions fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch intentions' },
      { status: 500 }
    )
  }
}

// POST /api/intentions - Save intentions (bulk upsert for onboarding)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { intentions } = body as {
      intentions: Array<{
        intention_type: IntentionType
        custom_text?: string | null
        weekly_target_minutes?: number | null
        priority: number
      }>
    }

    if (!intentions || !Array.isArray(intentions) || intentions.length === 0) {
      return NextResponse.json(
        { error: 'At least one intention is required' },
        { status: 400 }
      )
    }

    if (intentions.length > 3) {
      return NextResponse.json(
        { error: 'Maximum 3 intentions allowed' },
        { status: 400 }
      )
    }

    // Deactivate existing intentions
    await supabase
      .from('user_intentions')
      .update({ active: false })
      .eq('user_id', session.user.id)

    // Insert new intentions
    const intentionsToInsert = intentions.map((intention, index) => ({
      user_id: session.user.id,
      intention_type: intention.intention_type,
      custom_text: intention.intention_type === 'custom' ? intention.custom_text : null,
      weekly_target_minutes: intention.weekly_target_minutes || null,
      priority: intention.priority || index + 1,
      active: true,
    }))

    const { data: insertedIntentions, error: insertError } = await supabase
      .from('user_intentions')
      .insert(intentionsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting intentions:', insertError)
      return NextResponse.json(
        { error: 'Failed to save intentions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      intentions: insertedIntentions,
      message: 'Intentions saved successfully'
    })
  } catch (error) {
    console.error('Intentions save error:', error)
    return NextResponse.json(
      { error: 'Failed to save intentions' },
      { status: 500 }
    )
  }
}
