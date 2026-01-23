-- Rollback RLS changes from migration 016
-- The app uses client-side queries with anon key, which requires RLS disabled
-- (Supabase Auth's auth.uid() returns NULL since we use NextAuth)

ALTER TABLE time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens DISABLE ROW LEVEL SECURITY;
