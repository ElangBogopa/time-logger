import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { supabase } from './supabase-server'
import { SupabaseAdapter } from './auth-adapter'

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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
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
                auth_provider: 'google',
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

        // Get user id from our users table (try email first, then google_id)
        let dbUser = null
        if (email) {
          const { data } = await supabase
            .from('users')
            .select('id, preferred_name')
            .eq('email', email)
            .single()
          dbUser = data
        }
        if (!dbUser && profile?.sub) {
          const { data } = await supabase
            .from('users')
            .select('id, preferred_name')
            .eq('google_id', profile.sub)
            .single()
          dbUser = data
        }

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
      // Send user ID and error state to the client (NO access token)
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
