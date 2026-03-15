create extension if not exists pg_trgm;

create index if not exists company_profiles_company_name_trgm_idx
on company_profiles
using gin (company_name gin_trgm_ops);