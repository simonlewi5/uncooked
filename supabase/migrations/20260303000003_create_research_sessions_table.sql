-- Research sessions: chat history per company/board
CREATE TABLE research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE SET NULL,
  title TEXT,
  messages JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX research_sessions_user_id_idx ON research_sessions(user_id);
CREATE INDEX research_sessions_company_profile_id_idx ON research_sessions(company_profile_id);

-- Enable Row Level Security
ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own research sessions
CREATE POLICY "Users can view own research sessions"
  ON research_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own research sessions"
  ON research_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research sessions"
  ON research_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own research sessions"
  ON research_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER research_sessions_updated_at
  BEFORE UPDATE ON research_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
