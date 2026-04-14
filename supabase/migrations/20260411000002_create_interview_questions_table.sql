-- Interview questions: persisted question bank from interview sessions
CREATE TABLE interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interview_session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  question_text TEXT NOT NULL,
  category TEXT,
  source TEXT NOT NULL,
  is_bookmarked BOOLEAN DEFAULT false NOT NULL,
  answer_notes TEXT,
  chat_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX interview_questions_user_id_idx ON interview_questions(user_id);
CREATE INDEX interview_questions_session_id_idx ON interview_questions(interview_session_id);
CREATE INDEX interview_questions_company_profile_id_idx ON interview_questions(company_profile_id);
CREATE INDEX interview_questions_bookmarked_idx ON interview_questions(user_id, is_bookmarked) WHERE is_bookmarked = true;

-- Enable Row Level Security
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own questions"
  ON interview_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questions"
  ON interview_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questions"
  ON interview_questions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions"
  ON interview_questions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER interview_questions_updated_at
  BEFORE UPDATE ON interview_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
