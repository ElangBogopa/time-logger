-- Migration: Expand categories from 11 to 18 (Part 1: Add enum values)
-- This adds new granular categories for better time tracking
-- NOTE: Data migration happens in 022_migrate_category_data.sql

-- Add new categories to the enum
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'shallow_work';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'creating';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'errands';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'chores';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'commute';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'movement';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'sleep';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'social';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'calls';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'entertainment';

-- Note: PostgreSQL doesn't support removing enum values directly.
-- The old values ('distraction', 'relationships') will remain in the enum
-- but are deprecated. Data migration to new values happens in next migration.
