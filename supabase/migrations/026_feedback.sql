-- Migration: User feedback and app ratings

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  message TEXT,
  category TEXT CHECK (category IN ('bug', 'feature', 'general', 'praise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- RLS: deny-all (service role key bypasses)
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON feedback
  FOR ALL USING (false);
