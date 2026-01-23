-- Migration: Migrate data to new category values (Part 2)
-- Must run after 021_expand_categories.sql which adds the enum values

-- Update existing entries with old 'distraction' category to 'entertainment'
UPDATE time_entries SET category = 'entertainment' WHERE category = 'distraction';

-- Update existing entries with old 'relationships' category to 'social'
UPDATE time_entries SET category = 'social' WHERE category = 'relationships';

-- Note: 'distraction' and 'relationships' enum values still exist but are now deprecated.
-- The application no longer uses them.
