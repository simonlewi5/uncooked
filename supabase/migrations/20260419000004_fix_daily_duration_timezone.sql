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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    activity_type,
    (started_at AT TIME ZONE p_timezone)::date                         AS practice_date,
    ROUND(COALESCE(SUM(session_duration_seconds), 0) / 60.0)::int      AS duration_minutes
  FROM public.user_activity_sessions
  WHERE user_id = auth.uid()
    AND (started_at AT TIME ZONE p_timezone)::date >= p_start_date
    AND (started_at AT TIME ZONE p_timezone)::date  < p_end_date
  GROUP BY activity_type, (started_at AT TIME ZONE p_timezone)::date
  ORDER BY activity_type, (started_at AT TIME ZONE p_timezone)::date ASC;
$$;

REVOKE ALL ON FUNCTION public.get_daily_duration(date, date, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_daily_duration(date, date, text) TO authenticated;
