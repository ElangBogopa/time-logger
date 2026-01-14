import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const { email, password, preferredName } = await request.json()

    // Validate email format
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate password length
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // preferredName is optional - will be collected in onboarding
    const normalizedEmail = email.toLowerCase().trim()

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, auth_provider, password_hash, preferred_name')
      .eq('email', normalizedEmail)
      .single()

    if (existingUser) {
      // If user exists with Google but no password, allow adding password
      if (existingUser.auth_provider === 'google' && !existingUser.password_hash) {
        const passwordHash = await bcrypt.hash(password, 10)

        const { error: updateError } = await supabase
          .from('users')
          .update({
            password_hash: passwordHash,
            preferred_name: preferredName?.trim() || existingUser.preferred_name,
            auth_provider: 'both',
          })
          .eq('id', existingUser.id)

        if (updateError) {
          console.error('Error updating user:', updateError)
          return NextResponse.json(
            { error: 'Failed to update account' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Password added to your account',
        })
      }

      // User already has a password
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create new user
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        preferred_name: preferredName?.trim() || null,
        auth_provider: 'email',
      })

    if (insertError) {
      console.error('Error creating user:', insertError)
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
