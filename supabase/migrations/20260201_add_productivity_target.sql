-- Add productivity_target column to user_preferences table
-- This stores the user's productivity target percentage (50-100, default 80)
-- Used by the new onboarding flow (replaces weekly targets for onboarding trigger)

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS productivity_target integer DEFAULT 80;

-- Add constraint to ensure valid range
ALTER TABLE user_preferences
ADD CONSTRAINT productivity_target_range CHECK (productivity_target >= 50 AND productivity_target <= 100);
