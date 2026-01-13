-- Allow category to be NULL for pending entries
-- Pending entries don't have a category until they are confirmed

-- First, alter the column to allow NULL values
-- Note: The category column may have been changed to TEXT in a previous migration
ALTER TABLE time_entries
ALTER COLUMN category DROP NOT NULL;

-- Add a comment explaining the purpose
COMMENT ON COLUMN time_entries.category IS 'Category can be NULL for pending entries. Gets set when entry is confirmed via AI categorization.';
