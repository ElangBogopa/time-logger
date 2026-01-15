import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client with service role key.
 *
 * IMPORTANT: Only use this in server-side code (API routes, server actions).
 * This client bypasses RLS policies, so authentication must be handled
 * by NextAuth before making queries.
 *
 * The service role key should NEVER be exposed to the client.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceKey) {
  console.warn(
    '[Supabase] SUPABASE_SERVICE_ROLE_KEY not set. ' +
    'Server-side queries will use anon key and may be blocked by RLS.'
  )
}

// Export as 'supabase' for easy migration from client import
// Also export as 'supabaseServer' for explicit naming
export const supabase = createClient(supabaseUrl, supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export const supabaseServer = supabase
