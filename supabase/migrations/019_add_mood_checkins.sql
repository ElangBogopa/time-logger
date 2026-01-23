-- Migration: Add mood check-ins table
-- Tracks daily mood/energy levels for correlation with activities

CREATE TABLE IF NOT EXISTS mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date NOT NULL,
  mood text NOT NULL CHECK (mood IN ('low', 'okay', 'great')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Index for querying by user and date
CREATE INDEX IF NOT EXISTS idx_mood_checkins_user_date ON mood_checkins(user_id, date);

-- Comments
COMMENT ON TABLE mood_checkins IS 'Daily mood/energy check-ins for activity correlation';
COMMENT ON COLUMN mood_checkins.mood IS 'Energy level: low, okay, or great';
