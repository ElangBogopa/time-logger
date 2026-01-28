-- Re-enable RLS on all tables with deny-all policies.
-- Since we use NextAuth (not Supabase Auth), auth.uid() is always NULL.
-- All queries go through Next.js API routes which use the service role key,
-- which bypasses RLS entirely. The anon key (exposed to browsers) is blocked.

-- ============================================================
-- time_entries
-- ============================================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON time_entries;
CREATE POLICY "Deny direct access - use server" ON time_entries
  FOR ALL USING (false);

-- ============================================================
-- users
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON users;
CREATE POLICY "Deny direct access - use server" ON users
  FOR ALL USING (false);

-- ============================================================
-- user_intentions
-- ============================================================
ALTER TABLE user_intentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON user_intentions;
CREATE POLICY "Deny direct access - use server" ON user_intentions
  FOR ALL USING (false);

-- ============================================================
-- user_preferences
-- ============================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop old policies that used auth.uid() or current_setting
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Deny direct access - use server" ON user_preferences;

CREATE POLICY "Deny direct access - use server" ON user_preferences
  FOR ALL USING (false);

-- ============================================================
-- verification_tokens
-- ============================================================
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON verification_tokens;
CREATE POLICY "Deny direct access - use server" ON verification_tokens
  FOR ALL USING (false);

-- ============================================================
-- calendar_connections
-- ============================================================
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON calendar_connections;
CREATE POLICY "Deny direct access - use server" ON calendar_connections
  FOR ALL USING (false);

-- ============================================================
-- pending_calendar_connections
-- ============================================================
ALTER TABLE pending_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON pending_calendar_connections;
CREATE POLICY "Deny direct access - use server" ON pending_calendar_connections
  FOR ALL USING (false);

-- ============================================================
-- push_subscriptions (already had RLS from migration 014)
-- ============================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON push_subscriptions;
CREATE POLICY "Deny direct access - use server" ON push_subscriptions
  FOR ALL USING (false);

-- ============================================================
-- user_streaks
-- ============================================================
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Drop old JWT-based policies from migration 015
DROP POLICY IF EXISTS "Users can read own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can insert own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can delete own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Deny direct access - use server" ON user_streaks;

CREATE POLICY "Deny direct access - use server" ON user_streaks
  FOR ALL USING (false);

-- ============================================================
-- session_completions
-- ============================================================
ALTER TABLE session_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON session_completions;
CREATE POLICY "Deny direct access - use server" ON session_completions
  FOR ALL USING (false);

-- ============================================================
-- mood_checkins
-- ============================================================
ALTER TABLE mood_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON mood_checkins;
CREATE POLICY "Deny direct access - use server" ON mood_checkins
  FOR ALL USING (false);
