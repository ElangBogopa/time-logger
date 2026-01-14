import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET user info
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, preferred_name, auth_provider')
      .eq('id', session.user.id)
      .single()

    if (error) {
      // User might not exist in users table yet (legacy Google-only users)
      return NextResponse.json({
        id: session.user.id,
        email: session.user.email,
        preferred_name: session.user.name || session.user.preferredName,
        auth_provider: session.authProvider,
      })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      preferred_name: user.preferred_name,
      auth_provider: user.auth_provider,
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// PUT update user info
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { preferredName } = await request.json()

    if (!preferredName || preferredName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Try to update existing user
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', session.user.id)
      .single()

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({ preferred_name: preferredName.trim() })
        .eq('id', session.user.id)

      if (updateError) {
        console.error('Update user error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update name' },
          { status: 500 }
        )
      }
    } else {
      // User doesn't exist in users table yet (legacy scenario)
      // Create them now
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email,
          preferred_name: preferredName.trim(),
          auth_provider: session.authProvider || 'google',
        })

      if (insertError) {
        console.error('Insert user error:', insertError)
        return NextResponse.json(
          { error: 'Failed to save name' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      preferredName: preferredName.trim(),
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
