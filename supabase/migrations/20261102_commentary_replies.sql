-- Replies to AI commentary. One row per message; a thread is every row with
-- the same (user_id, subject_type, subject_key), ordered by seq.
--
-- Keyed by subject rather than by a commentary row: session and weekly
-- commentary are not stored anywhere, and day commentary only lands in
-- day_reviews once the day is finalized.
--
-- Dated filename on purpose: migrations apply lexicographically and
-- 20260201_add_productivity_target.sql already sorts after 033_, so a new
-- 034_ file would run before it on a fresh database.

CREATE TABLE commentary_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- What the thread is about
  subject_type TEXT NOT NULL CHECK (subject_type IN ('entry', 'day', 'session', 'week')),
  -- entry   -> time_entries.id
  -- day     -> 'YYYY-MM-DD'
  -- session -> 'YYYY-MM-DD:morning' | ':afternoon' | ':evening'
  -- week    -> week start 'YYYY-MM-DD'
  subject_key TEXT NOT NULL,

  -- Position in the thread, 1-based. The opening commentary is NOT stored
  -- here; it already exists on its own surface and is passed as context.
  seq INT NOT NULL CHECK (seq >= 1),

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),

  -- The commentary this thread hangs off, copied in on the first message.
  -- Day and week commentary can be regenerated when the underlying data
  -- changes; without this snapshot an old answer would read as a non sequitur
  -- against new commentary.
  subject_commentary TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, subject_type, subject_key, seq)
);

CREATE INDEX idx_commentary_replies_thread
  ON commentary_replies(user_id, subject_type, subject_key, seq);

CREATE INDEX idx_commentary_replies_user_created
  ON commentary_replies(user_id, created_at DESC);

-- RLS: deny-all (service role key bypasses)
ALTER TABLE commentary_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON commentary_replies
  FOR ALL USING (false);

COMMENT ON TABLE commentary_replies IS
  'Follow-up conversation on AI commentary. Threads are stored, never regenerated.';
COMMENT ON COLUMN commentary_replies.subject_commentary IS
  'Snapshot of the commentary the thread started from, so answers stay legible if it is later regenerated.';
