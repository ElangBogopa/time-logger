-- Migration: Replace intentions with evidence-based weekly targets
-- Each target maps to specific time_category values and has a direction (at_least / at_most)

-- Create enums
CREATE TYPE weekly_target_type AS ENUM (
  'deep_focus',
  'exercise',
  'social_time',
  'recovery',
  'leisure',
  'meetings'
);

CREATE TYPE target_direction AS ENUM (
  'at_least',
  'at_most'
);

-- Create weekly_targets table
CREATE TABLE weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  target_type weekly_target_type NOT NULL,
  direction target_direction NOT NULL,
  weekly_target_minutes INT NOT NULL CHECK (weekly_target_minutes > 0),
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each user can only have one target per type
  UNIQUE(user_id, target_type)
);

-- Indexes
CREATE INDEX idx_weekly_targets_user_id ON weekly_targets(user_id);
CREATE INDEX idx_weekly_targets_user_active ON weekly_targets(user_id, active) WHERE active = true;

-- RLS: deny-all (service role key bypasses)
ALTER TABLE weekly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON weekly_targets
  FOR ALL USING (false);

-- Data migration: map old user_intentions rows to new weekly_targets
-- Mapping:
--   deep_work  -> deep_focus (at_least)
--   learning   -> deep_focus (at_least) -- merged per user request
--   exercise   -> exercise (at_least)
--   relationships -> social_time (at_least)
--   self_care  -> recovery (at_least)
--   less_distraction -> leisure (at_most)
--   work_life_balance -> meetings (at_most)
--   custom     -> no mapping (users see onboarding again)

INSERT INTO weekly_targets (user_id, target_type, direction, weekly_target_minutes, sort_order, active)
SELECT
  ui.user_id,
  CASE ui.intention_type
    WHEN 'deep_work' THEN 'deep_focus'::weekly_target_type
    WHEN 'learning' THEN 'deep_focus'::weekly_target_type
    WHEN 'exercise' THEN 'exercise'::weekly_target_type
    WHEN 'relationships' THEN 'social_time'::weekly_target_type
    WHEN 'self_care' THEN 'recovery'::weekly_target_type
    WHEN 'less_distraction' THEN 'leisure'::weekly_target_type
    WHEN 'work_life_balance' THEN 'meetings'::weekly_target_type
  END,
  CASE ui.intention_type
    WHEN 'deep_work' THEN 'at_least'::target_direction
    WHEN 'learning' THEN 'at_least'::target_direction
    WHEN 'exercise' THEN 'at_least'::target_direction
    WHEN 'relationships' THEN 'at_least'::target_direction
    WHEN 'self_care' THEN 'at_least'::target_direction
    WHEN 'less_distraction' THEN 'at_most'::target_direction
    WHEN 'work_life_balance' THEN 'at_most'::target_direction
  END,
  COALESCE(ui.weekly_target_minutes, CASE ui.intention_type
    WHEN 'deep_work' THEN 900       -- 15 hrs default
    WHEN 'learning' THEN 900        -- 15 hrs default (merged into deep_focus)
    WHEN 'exercise' THEN 150        -- 2.5 hrs default
    WHEN 'relationships' THEN 600   -- 10 hrs default
    WHEN 'self_care' THEN 420       -- 7 hrs default
    WHEN 'less_distraction' THEN 600 -- 10 hrs default
    WHEN 'work_life_balance' THEN 600 -- 10 hrs default
  END),
  ui.priority,
  ui.active
FROM user_intentions ui
WHERE ui.intention_type != 'custom'
ON CONFLICT (user_id, target_type) DO UPDATE SET
  weekly_target_minutes = GREATEST(EXCLUDED.weekly_target_minutes, weekly_targets.weekly_target_minutes),
  active = EXCLUDED.active OR weekly_targets.active;

-- Note: user_intentions table is NOT dropped for rollback safety.
-- It will be removed in a future cleanup migration after verification.
