import { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters'
import { supabase } from './supabase-server'

/**
 * Custom partial adapter for NextAuth that handles verification tokens
 * using Supabase. Only implements methods needed for magic link authentication.
 */
export function SupabaseAdapter(): Adapter {
  return {
    // Create a new user (called when magic link is used by a new email)
    async createUser(user: Omit<AdapterUser, 'id'>) {
      console.log('[Adapter] createUser called with:', user.email)
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: user.email?.toLowerCase(),
          preferred_name: user.name,
          auth_provider: 'email',
        })
        .select('id, email, preferred_name, created_at')
        .single()

      if (error || !data) {
        console.error('[Adapter] createUser failed:', error)
        throw new Error('Failed to create user')
      }

      console.log('[Adapter] createUser success, id:', data.id)
      return {
        id: data.id,
        email: data.email,
        emailVerified: new Date(),
        name: data.preferred_name,
      }
    },

    // Get user by ID
    async getUser(id: string) {
      console.log('[Adapter] getUser called with id:', id)
      const { data, error } = await supabase
        .from('users')
        .select('id, email, preferred_name')
        .eq('id', id)
        .single()

      if (error || !data) {
        console.log('[Adapter] getUser: user not found for id:', id, 'error:', error?.message)
        return null
      }

      console.log('[Adapter] getUser found user:', data.id, data.email)
      return {
        id: data.id,
        email: data.email,
        emailVerified: new Date(),
        name: data.preferred_name,
      }
    },

    // Get user by email
    async getUserByEmail(email: string) {
      console.log('[Adapter] getUserByEmail called with:', email)
      const { data, error } = await supabase
        .from('users')
        .select('id, email, preferred_name')
        .eq('email', email.toLowerCase())
        .single()

      if (error || !data) {
        console.log('[Adapter] getUserByEmail: user not found')
        return null
      }

      console.log('[Adapter] getUserByEmail found user:', data.id)
      return {
        id: data.id,
        email: data.email,
        emailVerified: new Date(),
        name: data.preferred_name,
      }
    },

    // Get user by account (not used for magic links, but required by adapter)
    async getUserByAccount({ providerAccountId, provider }) {
      if (provider === 'google') {
        const { data } = await supabase
          .from('users')
          .select('id, email, preferred_name')
          .eq('google_id', providerAccountId)
          .single()

        if (!data) return null

        return {
          id: data.id,
          email: data.email,
          emailVerified: new Date(),
          name: data.preferred_name,
        }
      }
      return null
    },

    // Update user
    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      console.log('[Adapter] updateUser called with:', { id: user.id, name: user.name, email: user.email })

      const updates: Record<string, unknown> = {}
      if (user.name) updates.preferred_name = user.name
      if (user.email) updates.email = user.email.toLowerCase()

      // If no updates, just fetch and return the existing user
      if (Object.keys(updates).length === 0) {
        console.log('[Adapter] updateUser: no updates needed, fetching existing user')
        const { data, error } = await supabase
          .from('users')
          .select('id, email, preferred_name')
          .eq('id', user.id)
          .single()

        if (error || !data) {
          console.error('[Adapter] updateUser fetch failed:', error)
          throw new Error('Failed to fetch user')
        }

        return {
          id: data.id,
          email: data.email,
          emailVerified: new Date(),
          name: data.preferred_name,
        }
      }

      console.log('[Adapter] updateUser: updating with:', updates)
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select('id, email, preferred_name')
        .single()

      if (error || !data) {
        console.error('[Adapter] updateUser failed:', error)
        throw new Error('Failed to update user')
      }

      console.log('[Adapter] updateUser success:', data.id)
      return {
        id: data.id,
        email: data.email,
        emailVerified: new Date(),
        name: data.preferred_name,
      }
    },

    // Delete user (not typically used)
    async deleteUser(userId: string) {
      await supabase.from('users').delete().eq('id', userId)
    },

    // Link account (not used for magic links)
    async linkAccount(account: AdapterAccount) {
      // For magic links, we don't need to link accounts
      return account
    },

    // Unlink account (not used for magic links)
    async unlinkAccount(_params: { providerAccountId: string; provider: string }) {
      // Not implemented
    },

    // Create session (we use JWT, so this is not used)
    async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
      return { ...session, id: session.sessionToken } as AdapterSession
    },

    // Get session and user (we use JWT, so this is not used)
    async getSessionAndUser(_sessionToken: string) {
      return null
    },

    // Update session (we use JWT, so this is not used)
    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>) {
      return session as AdapterSession
    },

    // Delete session (we use JWT, so this is not used)
    async deleteSession(_sessionToken: string) {
      // Not implemented
    },

    // Create verification token for magic link
    async createVerificationToken({ identifier, expires, token }: VerificationToken) {
      console.log('[Adapter] createVerificationToken called for:', identifier)
      console.log('[Adapter] Token expires:', expires.toISOString())

      const { data, error } = await supabase
        .from('verification_tokens')
        .insert({
          identifier: identifier.toLowerCase(),
          token,
          expires: expires.toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('[Adapter] Failed to create verification token:', error)
        throw new Error('Failed to create verification token')
      }

      console.log('[Adapter] Verification token created successfully')
      return {
        identifier: data.identifier,
        token: data.token,
        expires: new Date(data.expires),
      }
    },

    // Use (consume) verification token
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      console.log('[Adapter] useVerificationToken called for:', identifier)
      // First, get the token
      const { data, error } = await supabase
        .from('verification_tokens')
        .select('*')
        .eq('identifier', identifier.toLowerCase())
        .eq('token', token)
        .single()

      if (error || !data) {
        console.error('[Adapter] Verification token not found:', error)
        return null
      }

      console.log('[Adapter] Token found, expires:', data.expires)

      // Check if expired
      if (new Date(data.expires) < new Date()) {
        console.error('[Adapter] Token has expired')
        // Still delete it
        await supabase
          .from('verification_tokens')
          .delete()
          .eq('identifier', identifier.toLowerCase())
          .eq('token', token)
        return null
      }

      // Delete the token (single use)
      await supabase
        .from('verification_tokens')
        .delete()
        .eq('identifier', identifier.toLowerCase())
        .eq('token', token)

      console.log('[Adapter] Token verified and consumed successfully')
      return {
        identifier: data.identifier,
        token: data.token,
        expires: new Date(data.expires),
      }
    },
  }
}
