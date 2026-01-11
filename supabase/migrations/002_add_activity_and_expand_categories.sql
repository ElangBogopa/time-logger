-- Add new category values to the enum
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'communication';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'exercise';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'creative';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'networking';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'planning';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'breaks';
ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'personal';

-- Add activity column to time_entries table
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT '';
