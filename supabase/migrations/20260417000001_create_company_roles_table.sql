-- Company roles: track specific positions/roles per company
CREATE TABLE company_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  job_description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX company_roles_user_id_idx ON company_roles(user_id);
CREATE INDEX company_roles_company_profile_id_idx ON company_roles(company_profile_id);

-- Enable RLS
ALTER TABLE company_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own company roles"
  ON company_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company roles"
  ON company_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company roles"
  ON company_roles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own company roles"
  ON company_roles FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER company_roles_updated_at
  BEFORE UPDATE ON company_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add company_role_id FK to existing tables
ALTER TABLE research_sessions
  ADD COLUMN company_role_id UUID REFERENCES company_roles(id) ON DELETE SET NULL;

ALTER TABLE interview_sessions
  ADD COLUMN company_role_id UUID REFERENCES company_roles(id) ON DELETE SET NULL;

ALTER TABLE interview_questions
  ADD COLUMN company_role_id UUID REFERENCES company_roles(id) ON DELETE SET NULL;

-- Indexes on new FK columns
CREATE INDEX research_sessions_company_role_id_idx ON research_sessions(company_role_id);
CREATE INDEX interview_sessions_company_role_id_idx ON interview_sessions(company_role_id);
CREATE INDEX interview_questions_company_role_id_idx ON interview_questions(company_role_id);
