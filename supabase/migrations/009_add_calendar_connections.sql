-- Calendar connections for email users who want to link Google Calendar
CREATE TABLE calendar_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One calendar connection per user
);

-- Index for fast lookups
CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER calendar_connections_updated_at_trigger
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_connections_updated_at();
