-- Add status column for pending/confirmed entries
-- Pending entries are future planned entries that haven't been confirmed yet
-- Confirmed entries are normal logged entries (past or confirmed)

ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- Add check constraint to ensure valid status values
ALTER TABLE time_entries
ADD CONSTRAINT time_entries_status_check
CHECK (status IN ('confirmed', 'pending'));

-- Create index for faster queries filtering by status
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
