import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import EmailProvider from 'next-auth/providers/email'
import { Resend } from 'resend'
import { supabase } from './supabase'
import { SupabaseAdapter } from './auth-adapter'

// Lazy initialization of Resend client
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

/**
 * Refresh the Google access token using the refresh token
 */
async function refreshAccessToken(token: {
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  id?: string
  error?: string
}) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken!,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw new Error(refreshedTokens.error || 'Failed to refresh token')
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // Google doesn't always return a new refresh token, keep the old one
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      error: undefined,
    }
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter(),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM || 'Time Logger <noreply@timelogger.app>',
      maxAge: 10 * 60, // 10 minutes
      async sendVerificationRequest({ identifier: email, url }) {
        console.log('[Auth] sendVerificationRequest called')
        console.log('[Auth] Email:', email)
        console.log('[Auth] URL:', url)

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 400px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 16px 0; text-align: center;">
      Sign in to Time Logger
    </h1>
    <p style="font-size: 15px; color: #6b7280; margin: 0 0 32px 0; text-align: center; line-height: 1.5;">
      Click the button below to sign in. This link will expire in 10 minutes.
    </p>
    <a href="${url}" style="display: block; background-color: #111827; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 15px; padding: 14px 24px; border-radius: 8px; text-align: center;">
      Sign In
    </a>
    <p style="font-size: 13px; color: #9ca3af; margin: 32px 0 0 0; text-align: center; line-height: 1.5;">
      If you didn't request this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>`

        const textContent = `Sign in to Time Logger

Click the link below to sign in. This link will expire in 10 minutes.

${url}

If you didn't request this email, you can safely ignore it.`

        console.log('[Auth] HTML length:', htmlContent.length)
        console.log('[Auth] Text length:', textContent.length)

        try {
          const emailPayload = {
            from: process.env.EMAIL_FROM || 'Time Logger <noreply@timelogger.app>',
            to: email,
            subject: 'Sign in to Time Logger',
            html: htmlContent,
            text: textContent,
          }

          console.log('[Auth] Sending email with payload:', {
            from: emailPayload.from,
            to: emailPayload.to,
            subject: emailPayload.subject,
            htmlLength: emailPayload.html.length,
            textLength: emailPayload.text.length,
          })

          const result = await getResend().emails.send(emailPayload)

          console.log('[Auth] Resend result:', result)

          if (result.error) {
            console.error('[Auth] Resend error:', result.error)
            throw new Error('Failed to send verification email')
          }

          console.log('[Auth] Magic link sent successfully to:', email)
        } catch (error) {
          console.error('[Auth] Failed to send magic link:', error)
          throw new Error('Failed to send verification email')
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[Auth] signIn callback:', {
        provider: account?.provider,
        userId: user?.id,
        userEmail: user?.email,
        hasProfile: !!profile,
      })

      // Handle email provider sign-in (magic link)
      if (account?.provider === 'email') {
        console.log('[Auth] Email provider sign-in for:', user?.email)

        // Check if this email has a Google account linked
        if (user?.email) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, google_id, auth_provider')
            .eq('email', user.email.toLowerCase())
            .single()

          if (existingUser?.google_id) {
            console.log('[Auth] User has Google account linked, redirecting to Google sign-in')
            // Redirect to login with message to use Google
            return '/login?error=google_account'
          }
        }

        return true
      }

      // Handle Google sign-in: create or link user record
      if (account?.provider === 'google' && profile?.email) {
        const email = profile.email.toLowerCase()
        const googleId = profile.sub
        const googleName = profile.name

        // Check if user exists with this email
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single()

        if (existingUser) {
          // Link Google account if not already linked
          if (!existingUser.google_id) {
            await supabase
              .from('users')
              .update({
                google_id: googleId,
                auth_provider: existingUser.password_hash ? 'both' : 'google',
                preferred_name: existingUser.preferred_name || googleName,
              })
              .eq('id', existingUser.id)
          }
        } else {
          // Create new user record
          await supabase
            .from('users')
            .insert({
              email,
              google_id: googleId,
              preferred_name: googleName,
              auth_provider: 'google',
            })
        }
      }
      return true
    },
    async jwt({ token, account, profile, user }) {
      console.log('[Auth] jwt callback:', {
        hasAccount: !!account,
        provider: account?.provider,
        hasUser: !!user,
        userId: user?.id,
        tokenId: token?.id,
      })

      // Initial sign in with Google - persist OAuth tokens
      if (account?.provider === 'google') {
        const email = profile?.email?.toLowerCase()

        // Get user id from our users table
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, preferred_name')
          .eq('email', email)
          .single()

        // Debug: Log the scopes we received from Google
        console.log('[Auth] Google sign-in:')
        console.log('[Auth]   - dbUser:', dbUser?.id)
        console.log('[Auth]   - profile.sub:', profile?.sub)
        console.log('[Auth]   - account.scope:', account.scope)
        console.log('[Auth]   - has access_token:', !!account.access_token)
        console.log('[Auth]   - has refresh_token:', !!account.refresh_token)
        console.log('[Auth]   - expires_at:', account.expires_at)

        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : 0,
          id: dbUser?.id || profile?.sub,
          preferredName: dbUser?.preferred_name || profile?.name,
          authProvider: 'google',
          error: undefined,
        }
      }

      // Initial sign in with magic link (email provider)
      if (account?.provider === 'email' && user) {
        console.log('[Auth] Magic link sign-in, user.id:', user.id, 'email:', user.email)
        return {
          ...token,
          id: user.id,
          preferredName: (user as { name?: string }).name,
          authProvider: 'email',
          error: undefined,
        }
      }

      // Subsequent requests - handle token refresh for Google users
      if (token.authProvider === 'google') {
        // Return previous token if the access token has not expired yet
        const bufferTime = 5 * 60 * 1000 // 5 minutes
        if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - bufferTime) {
          return token
        }

        // Access token has expired, try to refresh
        if (!token.refreshToken) {
          return {
            ...token,
            error: 'RefreshAccessTokenError',
          }
        }

        return refreshAccessToken(token)
      }

      return token
    },
    async session({ session, token }) {
      console.log('[Auth] session callback:', {
        tokenId: token.id,
        tokenSub: token.sub,
        authProvider: token.authProvider,
      })
      // Send access token, user ID, and error state to the client
      session.accessToken = token.accessToken as string
      session.user.id = token.id as string || token.sub as string
      session.user.preferredName = token.preferredName as string | undefined
      session.authProvider = token.authProvider as string | undefined
      session.error = token.error as string | undefined
      console.log('[Auth] session created for user:', session.user.id)
      return session
    },
    async redirect({ url, baseUrl }) {
      console.log('[Auth] redirect callback:', { url, baseUrl })
      // Allow relative callback URLs
      if (url.startsWith('/')) {
        const finalUrl = `${baseUrl}${url}`
        console.log('[Auth] Redirecting to:', finalUrl)
        return finalUrl
      }
      // Allow callbacks to same origin
      if (new URL(url).origin === baseUrl) {
        console.log('[Auth] Redirecting to same origin:', url)
        return url
      }
      console.log('[Auth] Redirecting to baseUrl:', baseUrl)
      return baseUrl
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect errors to login page
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NODE_ENV === 'development',
}

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    accessToken?: string
    error?: string
    authProvider?: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      preferredName?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    id?: string
    preferredName?: string
    authProvider?: string
    error?: string
  }
}
