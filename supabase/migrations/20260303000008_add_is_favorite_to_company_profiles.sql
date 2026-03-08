-- Add is_favorite flag to company_profiles so users can star/favorite companies
ALTER TABLE company_profiles
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

