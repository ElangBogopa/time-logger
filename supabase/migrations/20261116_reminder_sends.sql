-- Which reminder has been sent to whom, on which of their days.
--
-- The hourly reminders job is called late, or not at all, by a scheduler
-- that drops runs. So a reminder may be sent any time in its window, and
-- this is how a second run in the same window knows not to send it again.
-- One row per person, per local date, per reminder.
--
-- The UNIQUE constraint is the guard: the job inserts the row before it
-- sends, and a second insert fails.

CREATE TABLE IF NOT EXISTS reminder_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The date where the person is, not the server's.
  date DATE NOT NULL,
  -- 'midday' | 'evening' | 'night': the ids in user_preferences.reminder_times.
  reminder_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, date, reminder_id)
);

CREATE INDEX IF NOT EXISTS idx_reminder_sends_user_date
  ON reminder_sends(user_id, date);

-- RLS: deny-all (service role key bypasses)
ALTER TABLE reminder_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct access - use server" ON reminder_sends;

CREATE POLICY "Deny direct access - use server" ON reminder_sends
  FOR ALL USING (false);

COMMENT ON TABLE reminder_sends IS
  'One row per reminder sent to a person on one of their local dates, so a late or repeated run never sends it twice.';
