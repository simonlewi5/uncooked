-- Add resume_id column to interview_sessions so we can track which resume was
-- used during an interview and allow resuming with the same resume context.
ALTER TABLE interview_sessions
  ADD COLUMN resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;

CREATE INDEX interview_sessions_resume_id_idx ON interview_sessions(resume_id);
