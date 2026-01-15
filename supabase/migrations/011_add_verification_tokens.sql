-- Add verification_tokens table for magic link authentication
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (identifier, token)
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires);

-- Disable RLS for verification_tokens
-- Tokens are single-use and expire quickly, so RLS is not necessary
-- The token itself serves as the security mechanism
ALTER TABLE verification_tokens DISABLE ROW LEVEL SECURITY;
