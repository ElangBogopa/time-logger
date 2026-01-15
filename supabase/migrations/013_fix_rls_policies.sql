-- Fix RLS policies for user_intentions table
-- Since we use NextAuth (not Supabase Auth), auth.uid() returns NULL
-- These policies block direct access via anon key
-- Server-side code uses service role key which bypasses RLS

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view own intentions" ON user_intentions;
DROP POLICY IF EXISTS "Users can insert own intentions" ON user_intentions;
DROP POLICY IF EXISTS "Users can update own intentions" ON user_intentions;
DROP POLICY IF EXISTS "Users can delete own intentions" ON user_intentions;

-- Create restrictive policies (block anon key access)
-- Service role key bypasses these entirely
CREATE POLICY "Deny direct access - use server" ON user_intentions
  FOR ALL USING (false);

-- Also fix time_entries if needed (same pattern)
DROP POLICY IF EXISTS "Users can view own entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update own entries" ON time_entries;
DROP POLICY IF EXISTS "Users can delete own entries" ON time_entries;

CREATE POLICY "Deny direct access - use server" ON time_entries
  FOR ALL USING (false);

-- Fix users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Deny direct access - use server" ON users
  FOR ALL USING (false);

-- Fix verification_tokens table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'verification_tokens') THEN
    DROP POLICY IF EXISTS "Allow all for verification" ON verification_tokens;
    CREATE POLICY "Deny direct access - use server" ON verification_tokens
      FOR ALL USING (false);
  END IF;
END $$;
