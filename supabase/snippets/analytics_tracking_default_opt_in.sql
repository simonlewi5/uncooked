-- Variant A: Default opt-in (requires legal/GDPR justification and compliant consent UX)
ALTER TABLE public.users
  ALTER COLUMN analytics_tracking_enabled SET DEFAULT true;

UPDATE public.users
SET analytics_tracking_enabled = true
WHERE analytics_tracking_enabled IS NULL;

ALTER TABLE public.users
  ALTER COLUMN analytics_tracking_enabled SET NOT NULL;

COMMENT ON COLUMN public.users.analytics_tracking_enabled IS
  'Default opt-in variant applied. Ensure legal basis and user consent disclosures are compliant.';
