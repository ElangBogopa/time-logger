import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Initiate Google OAuth for calendar-only access
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const redirectPath = searchParams.get('redirect') || '/'

    if (!session?.user?.id) {
      console.log('[Calendar Connect] No session.user.id, redirecting to login')
      return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL))
    }

    console.log('[Calendar Connect] User ID:', session.user.id, 'Auth provider:', session.authProvider)

    // Encode state with user ID and redirect path
    const stateData = JSON.stringify({ userId: session.user.id, redirect: redirectPath })
    const state = Buffer.from(stateData).toString('base64')

    // Build Google OAuth URL with calendar-only scope
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Calendar connect error:', error)
    return NextResponse.redirect(new URL('/?error=calendar_connect_failed', process.env.NEXTAUTH_URL))
  }
}
