-- Add user_streaks table for tracking personal bests and streak metadata
-- Streaks are calculated on-the-fly, but personal bests need persistence

CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  streak_type text NOT NULL, -- 'deep_work', 'exercise', 'focus', 'learning', 'relationships', 'custom'
  intention_id uuid REFERENCES user_intentions(id) ON DELETE SET NULL, -- Optional link to intention

  -- Personal best tracking
  personal_best_days integer NOT NULL DEFAULT 0,
  personal_best_achieved_at timestamptz,

  -- Current streak metadata (cached for performance, recalculated daily)
  current_streak_days integer NOT NULL DEFAULT 0,
  current_streak_start_date date,
  last_calculated_at timestamptz DEFAULT now(),

  -- Grace days used this week (resets on Sunday)
  grace_days_used integer NOT NULL DEFAULT 0,
  grace_week_start date, -- Start of current grace tracking week

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Each user can only have one streak record per type
  UNIQUE(user_id, streak_type)
);

-- Enable RLS
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Users can only access their own streaks
CREATE POLICY "Users can read own streaks"
  ON user_streaks FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own streaks"
  ON user_streaks FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own streaks"
  ON user_streaks FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own streaks"
  ON user_streaks FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Index for fast lookups
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_streaks_updated_at();
