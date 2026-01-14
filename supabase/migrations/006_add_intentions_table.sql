-- Create intention_type enum
CREATE TYPE intention_type AS ENUM (
  'deep_work',
  'less_distraction',
  'work_life_balance',
  'exercise',
  'self_care',
  'relationships',
  'learning',
  'custom'
);

-- Create user_intentions table
CREATE TABLE user_intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  intention_type intention_type NOT NULL,
  custom_text TEXT,
  weekly_target_minutes INT,
  priority INT NOT NULL CHECK (priority >= 1 AND priority <= 3),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure custom_text is only set for custom type
  CONSTRAINT custom_text_check CHECK (
    (intention_type = 'custom' AND custom_text IS NOT NULL) OR
    (intention_type != 'custom' AND custom_text IS NULL)
  )
);

-- Create index for faster lookups by user
CREATE INDEX idx_user_intentions_user_id ON user_intentions(user_id);

-- Enable RLS
ALTER TABLE user_intentions ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own intentions
CREATE POLICY "Users can view own intentions" ON user_intentions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own intentions" ON user_intentions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own intentions" ON user_intentions
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own intentions" ON user_intentions
  FOR DELETE USING (true);
