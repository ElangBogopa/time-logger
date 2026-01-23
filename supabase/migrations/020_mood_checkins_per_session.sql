-- Migration: Update mood check-ins to be per-session
-- Each session (morning/afternoon/evening) gets its own mood entry

-- Add period column
ALTER TABLE mood_checkins ADD COLUMN IF NOT EXISTS period text;

-- Update constraint to allow one entry per user, date, AND period
-- First drop the old unique constraint
ALTER TABLE mood_checkins DROP CONSTRAINT IF EXISTS mood_checkins_user_id_date_key;

-- Add new unique constraint including period
ALTER TABLE mood_checkins ADD CONSTRAINT mood_checkins_user_date_period_key UNIQUE(user_id, date, period);

-- Add check constraint for valid periods
ALTER TABLE mood_checkins ADD CONSTRAINT mood_checkins_period_check CHECK (period IN ('morning', 'afternoon', 'evening'));

-- Update index
DROP INDEX IF EXISTS idx_mood_checkins_user_date;
CREATE INDEX IF NOT EXISTS idx_mood_checkins_user_date_period ON mood_checkins(user_id, date, period);

-- Comments
COMMENT ON COLUMN mood_checkins.period IS 'Session period: morning, afternoon, or evening';
