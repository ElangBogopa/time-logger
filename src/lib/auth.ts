import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabase } from './supabase'

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
  providers: [
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
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Look up user by email
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', credentials.email.toLowerCase())
          .single()

        if (error || !user) {
          throw new Error('No account found with this email')
        }

        // Check if user has a password set
        if (!user.password_hash) {
          throw new Error('Please sign in with Google')
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!isValid) {
          throw new Error('Incorrect password')
        }

        // Return user object for session
        return {
          id: user.id,
          email: user.email,
          name: user.preferred_name,
          authProvider: user.auth_provider,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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

      // Initial sign in with credentials
      if (account?.provider === 'credentials' && user) {
        console.log('[Auth] Credentials sign-in, user.id:', user.id)
        return {
          ...token,
          id: user.id,
          preferredName: (user as { name?: string }).name,
          authProvider: 'credentials',
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
      // Send access token, user ID, and error state to the client
      session.accessToken = token.accessToken as string
      session.user.id = token.id as string || token.sub as string
      session.user.preferredName = token.preferredName as string | undefined
      session.authProvider = token.authProvider as string | undefined
      session.error = token.error as string | undefined
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
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
