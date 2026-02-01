-- Track which session period a task was completed in (morning/afternoon/evening)
-- Tasks can only be checked off from session pages, not the planning page
ALTER TABLE daily_plans
  ADD COLUMN completed_session TEXT CHECK (completed_session IN ('morning', 'afternoon', 'evening'));

-- When completed is false, completed_session should be null
-- When completed is true, completed_session should be set
COMMENT ON COLUMN daily_plans.completed_session IS 'Which session period the task was completed in';
