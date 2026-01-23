-- Enable RLS on tables that have policies but RLS disabled
-- The "Deny direct access - use server" policies from migration 013
-- require RLS to be enabled to take effect

-- Enable RLS on time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on verification_tokens
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- Ensure the deny policy exists on verification_tokens
-- (migration 013 used a DO block which may not have created it reliably)
DROP POLICY IF EXISTS "Deny direct access - use server" ON verification_tokens;
CREATE POLICY "Deny direct access - use server" ON verification_tokens
  FOR ALL USING (false);
