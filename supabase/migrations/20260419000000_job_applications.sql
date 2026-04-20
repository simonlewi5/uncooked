alter table resumes
  add column if not exists job_application_id uuid references job_applications(id) on delete set null;