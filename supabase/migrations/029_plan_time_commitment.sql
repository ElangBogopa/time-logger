-- Add time commitment columns to daily_plans
-- When a user "commits" a task, they assign it a time block on the calendar
ALTER TABLE daily_plans
  ADD COLUMN committed_start TIME,
  ADD COLUMN committed_end TIME;

-- Index for efficient calendar queries (find committed tasks for a date)
CREATE INDEX idx_daily_plans_committed ON daily_plans(user_id, date)
  WHERE committed_start IS NOT NULL;
