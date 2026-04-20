-- Fix get_daily_duration to bucket sessions by the caller's local date rather
-- than UTC, so the bar chart days match what the user's clock says.
--
-- Before: session_date was computed in the MV as UTC, and the RPC filtered by
-- that UTC date. Users in non-UTC timezones saw sessions attributed to the
-- wrong day (e.g. Sunday-evening activity appearing in Monday's bar).
--
-- After: the caller passes their IANA timezone; the RPC converts created_at
-- to that timezone before computing the date, so midnight boundaries align
-- with local time.

DROP FUNCTION IF EXISTS public.get_daily_duration(date, date);

CREATE FUNCTION public.get_daily_duration(
  p_start_date date DEFAULT current_date - 6,
  p_end_date   date DEFAULT current_date + 1,
  p_timezone   text DEFAULT 'UTC'
)
RETURNS TABLE (
  activity_type    text,
  practice_date    date,
  duration_minutes int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz text;
BEGIN
  -- Reject unrecognised timezone names to prevent runtime errors.
  -- Falls back to UTC so the query always succeeds.
  SELECT name INTO tz FROM pg_timezone_names WHERE name = p_timezone LIMIT 1;
  tz := COALESCE(tz, 'UTC');

  RETURN QUERY
  SELECT
    uas.activity_type,
    (uas.started_at AT TIME ZONE tz)::date                         AS practice_date,
    ROUND(COALESCE(SUM(uas.session_duration_seconds), 0) / 60.0)::int AS duration_minutes
  FROM public.user_activity_sessions uas
  WHERE uas.user_id = auth.uid()
    AND (uas.started_at AT TIME ZONE tz)::date >= p_start_date
    AND (uas.started_at AT TIME ZONE tz)::date  < p_end_date
  GROUP BY uas.activity_type, (uas.started_at AT TIME ZONE tz)::date
  ORDER BY uas.activity_type, (uas.started_at AT TIME ZONE tz)::date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_duration(date, date, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_daily_duration(date, date, text) TO authenticated;
