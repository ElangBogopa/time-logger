-- User goals: high-level objectives like "Increase Productivity"
CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX idx_user_goals_user_active ON user_goals(user_id, active) WHERE active = true;

-- RLS: deny-all (service role key bypasses)
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON user_goals
  FOR ALL USING (false);
