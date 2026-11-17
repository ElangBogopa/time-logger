-- Let an entry's end be earlier than its start.
--
-- A night's sleep is one row whose end is earlier than its start: 23:00–07:00
-- on the day it ended. The constraint added in 012 refused it. What may cross
-- midnight is now decided by the API (src/lib/overnight.ts): sleep stays one
-- row, anything else is split at midnight into two.

ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_time_check;
