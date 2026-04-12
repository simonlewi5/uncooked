-- Interview sessions: persist interview simulator chats so users can revisit them
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  job_description TEXT,
  interview_style TEXT,
  messages JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX interview_sessions_user_id_idx ON interview_sessions(user_id);
CREATE INDEX interview_sessions_company_profile_id_idx ON interview_sessions(company_profile_id);

-- Enable Row Level Security
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own interview sessions
CREATE POLICY "Users can view own interview sessions"
  ON interview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interview sessions"
  ON interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview sessions"
  ON interview_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interview sessions"
  ON interview_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER interview_sessions_updated_at
  BEFORE UPDATE ON interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
