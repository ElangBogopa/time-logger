-- Add user_preferences table for app settings including logging reminders

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Logging reminder settings
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_times JSONB NOT NULL DEFAULT '[
    {"id": "midday", "label": "Midday check-in", "time": "12:00", "enabled": true},
    {"id": "evening", "label": "Evening check-in", "time": "18:00", "enabled": true},
    {"id": "night", "label": "Night check-in", "time": "21:00", "enabled": true}
  ]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();
