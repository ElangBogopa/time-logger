-- Seed data for local development
-- This runs after all migrations when using `supabase db reset`

-- Create a test user for local development
INSERT INTO users (id, email, preferred_name, auth_provider)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev@localhost',
  'Dev User',
  'email'
)
ON CONFLICT (email) DO NOTHING;

-- Create some sample intentions
INSERT INTO user_intentions (user_id, intention_type, weekly_target_minutes, priority, active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'deep_work', 1200, 1, true),
  ('00000000-0000-0000-0000-000000000001', 'exercise', 300, 2, true),
  ('00000000-0000-0000-0000-000000000001', 'learning', 420, 3, true)
ON CONFLICT DO NOTHING;

-- Create some sample time entries for today
INSERT INTO time_entries (user_id, date, activity, category, duration_minutes, start_time, end_time, status, commentary)
VALUES
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'Morning coding session', 'deep_work', 90, '09:00', '10:30', 'confirmed', 'Solid focus block to start the day.'),
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'Coffee break', 'rest', 15, '10:30', '10:45', 'confirmed', 'Caffeine refuel.'),
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'Team standup', 'meetings', 30, '11:00', '11:30', 'confirmed', 'Quick sync with the team.'),
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'Lunch', 'meals', 45, '12:00', '12:45', 'confirmed', 'Refueling time.')
ON CONFLICT DO NOTHING;
