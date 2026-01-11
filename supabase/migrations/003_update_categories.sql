-- Add new category values
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'rest';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'relationships';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'distraction';

-- Note: PostgreSQL doesn't support removing enum values directly.
-- The old unused values (communication, creative, networking, planning, breaks, personal, health)
-- will remain in the enum but won't be used by the application.
-- If you need to clean them up, you would need to:
-- 1. Create a new enum type with only the desired values
-- 2. Update the column to use the new type
-- 3. Drop the old type
--
-- For a fresh database, use this instead of migrations 001-003:
--
-- CREATE TYPE time_category AS ENUM (
--   'deep_work', 'meetings', 'admin', 'learning', 'exercise',
--   'rest', 'relationships', 'distraction', 'other'
-- );
--
-- CREATE TABLE time_entries (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id TEXT NOT NULL,
--   date DATE NOT NULL,
--   activity TEXT NOT NULL DEFAULT '',
--   category time_category NOT NULL,
--   duration_minutes INTEGER NOT NULL,
--   description TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
