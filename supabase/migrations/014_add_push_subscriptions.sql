-- Push notification subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,  -- Public key for encryption
  auth TEXT NOT NULL,     -- Auth secret
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One subscription per endpoint per user
  UNIQUE(user_id, endpoint)
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS: Deny direct access (use service role key)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access - use server" ON push_subscriptions
  FOR ALL USING (false);
