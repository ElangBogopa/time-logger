-- Temporary storage for calendar connections during conflict resolution
-- These records should be cleaned up after a short time (1 hour)

CREATE TABLE pending_calendar_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Automatically expire after 1 hour
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Index for cleanup queries
CREATE INDEX idx_pending_calendar_expires ON pending_calendar_connections(expires_at);

-- Function to clean up expired pending connections
CREATE OR REPLACE FUNCTION cleanup_expired_pending_connections()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_calendar_connections WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
