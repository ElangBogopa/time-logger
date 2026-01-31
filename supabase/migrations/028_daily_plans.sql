-- Daily plans: what the user plans to do on a given day
-- Productivity = did they do what they planned?
CREATE TABLE daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  goal_id UUID REFERENCES user_goals(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, date);
CREATE INDEX idx_daily_plans_goal ON daily_plans(goal_id);

-- RLS: deny-all (service role key bypasses)
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON daily_plans
  FOR ALL USING (false);
