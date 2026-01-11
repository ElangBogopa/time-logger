-- Create enum type for categories
CREATE TYPE time_category AS ENUM ('deep_work', 'meetings', 'admin', 'learning', 'health', 'other');

-- Create time_entries table
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  category time_category NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);

-- Create index on date for faster date-based queries
CREATE INDEX idx_time_entries_date ON time_entries(date);

-- Enable Row Level Security
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own entries
CREATE POLICY "Users can view own entries" ON time_entries
  FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own entries
CREATE POLICY "Users can insert own entries" ON time_entries
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own entries
CREATE POLICY "Users can update own entries" ON time_entries
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own entries
CREATE POLICY "Users can delete own entries" ON time_entries
  FOR DELETE USING (auth.uid()::text = user_id);
