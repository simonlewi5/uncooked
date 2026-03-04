-- Job applications: tracks Applied/Interviewing/Offer status per job
CREATE TYPE application_status AS ENUM (
  'saved',
  'applied',
  'phone_screen',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn'
);

CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE SET NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  job_url TEXT,
  job_description TEXT,
  status application_status DEFAULT 'saved' NOT NULL,
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX job_applications_user_id_idx ON job_applications(user_id);
CREATE INDEX job_applications_company_profile_id_idx ON job_applications(company_profile_id);
CREATE INDEX job_applications_status_idx ON job_applications(status);

-- Enable Row Level Security
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own job applications
CREATE POLICY "Users can view own job applications"
  ON job_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job applications"
  ON job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job applications"
  ON job_applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job applications"
  ON job_applications FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-set applied_at when status changes to 'applied'
CREATE OR REPLACE FUNCTION set_applied_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'applied' AND OLD.status != 'applied' AND NEW.applied_at IS NULL THEN
    NEW.applied_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_applications_set_applied_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION set_applied_at();
