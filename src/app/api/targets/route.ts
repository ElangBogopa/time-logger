import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { WeeklyTargetType, TargetDirection, MAX_WEEKLY_TARGETS, WEEKLY_TARGET_CONFIGS } from '@/lib/types'

// GET /api/targets - Fetch user's active weekly targets
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { data: targets, error } = await supabase
      .from('weekly_targets')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching targets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch targets' },
        { status: 500 }
      )
    }

    return NextResponse.json({ targets: targets || [] })
  } catch (error) {
    console.error('Targets fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch targets' },
      { status: 500 }
    )
  }
}

// POST /api/targets - Bulk upsert targets (onboarding)
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
    const { targets } = body as {
      targets: Array<{
        target_type: WeeklyTargetType
        weekly_target_minutes: number
      }>
    }

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: 'At least one target is required' },
        { status: 400 }
      )
    }

    if (targets.length > MAX_WEEKLY_TARGETS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_WEEKLY_TARGETS} targets allowed` },
        { status: 400 }
      )
    }

    // Validate target types and minutes
    const validTypes = Object.keys(WEEKLY_TARGET_CONFIGS) as WeeklyTargetType[]
    for (const t of targets) {
      if (!validTypes.includes(t.target_type)) {
        return NextResponse.json(
          { error: `Invalid target type: ${t.target_type}` },
          { status: 400 }
        )
      }
      if (!t.weekly_target_minutes || t.weekly_target_minutes <= 0) {
        return NextResponse.json(
          { error: `Invalid target minutes for ${t.target_type}` },
          { status: 400 }
        )
      }
    }

    // Deactivate all existing targets for this user
    await supabase
      .from('weekly_targets')
      .update({ active: false })
      .eq('user_id', session.user.id)

    // Upsert new targets
    const targetsToUpsert = targets.map((t, index) => {
      const config = WEEKLY_TARGET_CONFIGS[t.target_type]
      return {
        user_id: session.user.id,
        target_type: t.target_type,
        direction: config.direction as TargetDirection,
        weekly_target_minutes: t.weekly_target_minutes,
        sort_order: index,
        active: true,
      }
    })

    const { data: upserted, error: upsertError } = await supabase
      .from('weekly_targets')
      .upsert(targetsToUpsert, { onConflict: 'user_id,target_type' })
      .select()

    if (upsertError) {
      console.error('Error upserting targets:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save targets' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      targets: upserted,
      message: 'Targets saved successfully',
    })
  } catch (error) {
    console.error('Targets save error:', error)
    return NextResponse.json(
      { error: 'Failed to save targets' },
      { status: 500 }
    )
  }
}
