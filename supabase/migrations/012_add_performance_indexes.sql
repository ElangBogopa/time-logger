-- Add composite indexes for common query patterns
-- These indexes significantly improve performance for queries that filter by user_id + date or user_id + status + date

-- Composite index for fetching entries by user and date (most common query)
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date
ON time_entries(user_id, date);

-- Composite index for fetching entries by user, status, and date (for weekly/range queries)
CREATE INDEX IF NOT EXISTS idx_time_entries_user_status_date
ON time_entries(user_id, status, date DESC);

-- Add updated_at column for optimistic locking (concurrent edit detection)
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
CREATE TRIGGER update_time_entries_updated_at
    BEFORE UPDATE ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add check constraint for time validity (end_time >= start_time when both are set)
-- Note: Using a function to handle the constraint logic for nullable columns
ALTER TABLE time_entries
DROP CONSTRAINT IF EXISTS time_entries_time_check;

ALTER TABLE time_entries
ADD CONSTRAINT time_entries_time_check
CHECK (
    start_time IS NULL
    OR end_time IS NULL
    OR end_time >= start_time
);

-- Add index on intentions table for common queries
CREATE INDEX IF NOT EXISTS idx_intentions_user_week
ON intentions(user_id, week_start);

CREATE INDEX IF NOT EXISTS idx_intentions_user_active
ON intentions(user_id, is_active)
WHERE is_active = true;
