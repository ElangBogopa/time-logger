-- Add session_completions table to track when users complete/skip logging sessions
-- This enables session-based streaks and the "Done with [period]" flow

CREATE TABLE IF NOT EXISTS session_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date NOT NULL,
  period text NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  entry_count int NOT NULL DEFAULT 0,
  total_minutes int NOT NULL DEFAULT 0,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Each user can only complete each period once per day
  UNIQUE(user_id, date, period)
);

-- Index for efficient queries by user and date
CREATE INDEX IF NOT EXISTS idx_session_completions_user_date
ON session_completions(user_id, date);

-- Index for streak calculations (find consecutive days)
CREATE INDEX IF NOT EXISTS idx_session_completions_user_period_date
ON session_completions(user_id, period, date DESC);

COMMENT ON TABLE session_completions IS 'Tracks when users complete or skip logging sessions (morning/afternoon/evening)';
COMMENT ON COLUMN session_completions.skipped IS 'True if user explicitly chose "Nothing to log" for this session';
