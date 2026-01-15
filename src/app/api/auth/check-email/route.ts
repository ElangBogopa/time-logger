import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists with this email
    const { data: user } = await supabase
      .from('users')
      .select('id, auth_provider, password_hash, preferred_name')
      .eq('email', normalizedEmail)
      .single()

    if (!user) {
      return NextResponse.json({
        exists: false,
        hasPassword: false,
        authProvider: null,
        preferredName: null,
      })
    }

    return NextResponse.json({
      exists: true,
      hasPassword: !!user.password_hash,
      authProvider: user.auth_provider,
      preferredName: user.preferred_name,
    })
  } catch (error) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
