-- Add productivity_target column to user_preferences table
-- This stores the user's productivity target percentage (50-100, default 80)
-- Used by the new onboarding flow (replaces weekly targets for onboarding trigger)

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS productivity_target integer DEFAULT 80;

-- Add constraint to ensure valid range.
-- Dropped first so this migration can be re-run: ADD CONSTRAINT has no
-- IF NOT EXISTS, and a second run would otherwise abort the whole push.
ALTER TABLE user_preferences
DROP CONSTRAINT IF EXISTS productivity_target_range;

ALTER TABLE user_preferences
ADD CONSTRAINT productivity_target_range CHECK (productivity_target >= 50 AND productivity_target <= 100);
