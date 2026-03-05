-- Practice sessions: track user practice activity for dashboard consistency metrics
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for faster user/date lookups
CREATE INDEX practice_sessions_user_id_created_at_idx
  ON practice_sessions (user_id, created_at);

-- Enable Row Level Security
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own practice sessions
CREATE POLICY "Users can view own practice sessions"
  ON practice_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice sessions"
  ON practice_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice sessions"
  ON practice_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER practice_sessions_updated_at
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

