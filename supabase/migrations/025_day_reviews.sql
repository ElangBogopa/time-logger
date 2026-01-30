-- Migration: Persistent day reviews
-- Reviews are generated live for today/yesterday (editable window),
-- then finalized and saved permanently once the day is locked (2+ days ago).

CREATE TABLE day_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,

  -- Core metrics
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  score_color TEXT NOT NULL CHECK (score_color IN ('green', 'orange', 'red')),

  -- Session summary
  sessions_logged INT NOT NULL DEFAULT 0,
  total_sessions INT NOT NULL DEFAULT 3,
  total_minutes_logged INT NOT NULL DEFAULT 0,

  -- AI commentary
  commentary TEXT,

  -- Structured data (stored as JSONB)
  wins JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  aggregated_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  longest_focus_session JSONB,
  mood JSONB,

  -- Finalization
  finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each user gets one review per date
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_day_reviews_user_id ON day_reviews(user_id);
CREATE INDEX idx_day_reviews_user_date ON day_reviews(user_id, date);
CREATE INDEX idx_day_reviews_finalized ON day_reviews(user_id, finalized) WHERE finalized = false;

-- RLS: deny-all (service role key bypasses)
ALTER TABLE day_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON day_reviews
  FOR ALL USING (false);
