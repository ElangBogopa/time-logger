/**
 * @deprecated DO NOT import this in web app code.
 *
 * This client uses the anon key which is blocked by RLS.
 * - For server-side code (API routes): use '@/lib/supabase-server'
 * - For client-side code (components): use '@/lib/api' helper functions
 *
 * This file is only kept for the mobile/ directory which has its own auth flow.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
