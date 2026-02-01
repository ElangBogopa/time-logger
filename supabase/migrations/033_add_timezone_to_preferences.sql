-- Add timezone column to user_preferences for accurate notification scheduling
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;

COMMENT ON COLUMN user_preferences.timezone IS 'IANA timezone identifier e.g. America/Toronto, auto-detected from client';
